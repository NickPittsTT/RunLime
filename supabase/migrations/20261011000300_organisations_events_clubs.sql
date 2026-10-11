-- Organisations (organiser applications + verification), core events table, clubs, rate limiting.

-- ---------------------------------------------------------------------------
-- Rate limiting helper (fixed window per bucket+subject)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket text not null,
  subject uuid not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, subject, window_start)
);
alter table public.rate_limits enable row level security; -- no policies: only SECURITY DEFINER code touches it

create function public.check_rate_limit(p_bucket text, p_limit integer, p_window interval) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_subject uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000');
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
  v_count integer;
begin
  insert into public.rate_limits as rl (bucket, subject, window_start, count)
  values (p_bucket, v_subject, v_window, 1)
  on conflict (bucket, subject, window_start) do update set count = rl.count + 1
  returning count into v_count;
  if v_count > p_limit then
    raise exception 'Too many requests, please try again later' using errcode = 'P0429';
  end if;
end;
$$;
revoke execute on function public.check_rate_limit from public, anon, authenticated;

create function public.setting_int(p_key text, p_default integer) returns integer
language sql stable security definer
set search_path = ''
as $$ select coalesce((select (value #>> '{}')::integer from public.app_settings where key = p_key), p_default) $$;

-- ---------------------------------------------------------------------------
-- Organisations
-- ---------------------------------------------------------------------------
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  contact_email extensions.citext not null,
  contact_phone text not null,
  website text,
  about text not null,
  is_charity boolean not null default false,
  status public.organisation_status not null default 'applied',
  rejection_reason text,
  reviewed_at timestamptz,
  country_code char(2) not null default 'TT' references public.countries (code),
  timezone text not null default 'America/Port_of_Spain',
  currency char(3) not null default 'TTD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rejection_needs_reason check (status <> 'rejected' or rejection_reason is not null)
);
create trigger organisations_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();

create table public.organisation_members (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.organisation_member_role not null default 'manager',
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);
create index organisation_members_user_idx on public.organisation_members (user_id);

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;
revoke all on public.organisations, public.organisation_members from anon, authenticated;
grant select on public.organisations, public.organisation_members to authenticated;

create function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.organisation_members m where m.organisation_id = p_org and m.user_id = auth.uid()) $$;

create policy "members and admins read organisations" on public.organisations for select to authenticated
  using ((select public.is_org_member(id)) or (select public.is_admin()));
create policy "members and admins read memberships" on public.organisation_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_org_member(organisation_id)) or (select public.is_admin()));

create function public.slugify(p_text text) returns text
language sql immutable
set search_path = ''
as $$ select trim(both '-' from regexp_replace(lower(p_text), '[^a-z0-9]+', '-', 'g')) $$;

-- Apply to become an organiser. Account is already 18+ (hard rule), so no extra age check is needed.
create function public.apply_as_organiser(
  p_name text, p_contact_email text, p_contact_phone text, p_website text, p_about text, p_is_charity boolean
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_slug text;
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Complete your profile first' using errcode = '42501';
  end if;
  perform public.check_rate_limit('organiser_application', public.setting_int('ratelimit.organiser_applications_per_day', 3), interval '1 day');
  if exists (
    select 1 from public.organisations o join public.organisation_members m on m.organisation_id = o.id
     where m.user_id = v_uid and o.status = 'applied'
  ) then
    raise exception 'You already have an application waiting for review' using errcode = '23505';
  end if;
  if char_length(btrim(coalesce(p_about, ''))) < 20 then
    raise exception 'Tell us a little more about the organisation' using errcode = '22023';
  end if;
  v_slug := public.slugify(p_name);
  if v_slug = '' then
    raise exception 'Invalid organisation name' using errcode = '22023';
  end if;
  if exists (select 1 from public.organisations where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;
  insert into public.organisations (name, slug, contact_email, contact_phone, website, about, is_charity)
  values (btrim(p_name), v_slug, p_contact_email, btrim(p_contact_phone), nullif(btrim(p_website), ''), btrim(p_about), coalesce(p_is_charity, false))
  returning id into v_org;
  insert into public.organisation_members (organisation_id, user_id, role) values (v_org, v_uid, 'owner');
  return v_org;
end;
$$;
revoke execute on function public.apply_as_organiser from public, anon;
grant execute on function public.apply_as_organiser to authenticated;

-- Admin review: verify / reject (reason required) / suspend / reinstate.
create function public.review_organisation(p_org uuid, p_decision public.organisation_status, p_reason text default null) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_current public.organisation_status;
begin
  if not public.is_admin() then
    raise exception 'Admin access requires MFA' using errcode = '42501';
  end if;
  select status into v_current from public.organisations where id = p_org for update;
  if v_current is null then
    raise exception 'Unknown organisation' using errcode = '22023';
  end if;
  if p_decision = 'applied' then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;
  if p_decision = 'suspended' and char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A suspension reason is required' using errcode = '22023';
  end if;

  update public.organisations
     set status = p_decision,
         rejection_reason = case when p_decision in ('rejected', 'suspended') then btrim(p_reason) else null end,
         reviewed_at = now()
   where id = p_org;

  if p_decision = 'verified' then
    insert into public.user_roles (user_id, role)
    select m.user_id, 'organiser' from public.organisation_members m where m.organisation_id = p_org
    on conflict do nothing;
  elsif p_decision in ('suspended', 'rejected') then
    -- Remove the organiser role from members who no longer belong to any verified organisation.
    delete from public.user_roles r
     where r.role = 'organiser'
       and r.user_id in (select m.user_id from public.organisation_members m where m.organisation_id = p_org)
       and not exists (
         select 1 from public.organisation_members m2 join public.organisations o2 on o2.id = m2.organisation_id
          where m2.user_id = r.user_id and o2.status = 'verified' and o2.id <> p_org);
  end if;
end;
$$;
revoke execute on function public.review_organisation from public, anon;
grant execute on function public.review_organisation to authenticated;

-- ---------------------------------------------------------------------------
-- Events (core). Phase 1 ships schema + read policies + seed; the editor and write paths arrive in Phase 2.
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 3 and 140),
  description text not null default '',
  starts_at timestamptz not null,
  timezone text not null default 'America/Port_of_Spain',
  country_code char(2) not null default 'TT' references public.countries (code),
  region_id uuid not null references public.regions (id),
  corporation_id uuid references public.regions (id),
  venue_name text not null,
  start_lat double precision not null check (start_lat between -90 and 90),
  start_lng double precision not null check (start_lng between -180 and 180),
  registration_url text,
  registration_instructions text,
  package_collection text,
  parking text,
  contact_email text,
  contact_phone text,
  cause text,
  charity_name text,
  walk_friendly boolean not null default false,
  fee_min numeric(12, 2) not null default 0 check (fee_min >= 0),
  fee_max numeric(12, 2) check (fee_max is null or fee_max >= fee_min),
  currency char(3) not null default 'TTD',
  status public.event_status not null default 'draft',
  status_reason text,
  featured_until timestamptz,
  checkin_radius_m integer check (checkin_radius_m is null or checkin_radius_m between 50 and 5000),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_status_start_idx on public.events (status, starts_at);
create index events_org_idx on public.events (organisation_id);
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_distances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  distance_km numeric(5, 2) not null check (distance_km > 0 and distance_km <= 100),
  label text not null,
  unique (event_id, label)
);

alter table public.events enable row level security;
alter table public.event_distances enable row level security;
revoke all on public.events, public.event_distances from anon, authenticated;
grant select on public.events, public.event_distances to anon, authenticated;

create policy "public events are readable" on public.events for select
  using (
    status in ('published', 'postponed', 'cancelled')
    or (select public.is_org_member(organisation_id))
    or (select public.is_admin())
  );
create policy "distances follow event visibility" on public.event_distances for select
  using (exists (select 1 from public.events e where e.id = event_id));

-- ---------------------------------------------------------------------------
-- Clubs (admin-managed, F4) and membership
-- ---------------------------------------------------------------------------
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 500),
  region_id uuid references public.regions (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clubs_name_key on public.clubs (lower(name)) where archived_at is null;
create trigger clubs_updated_at before update on public.clubs
  for each row execute function public.set_updated_at();

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
revoke all on public.clubs, public.club_members from anon, authenticated;
grant select on public.clubs to anon, authenticated;
grant insert, update (name, description, region_id, archived_at) on public.clubs to authenticated;
grant select, insert, delete on public.club_members to authenticated;

create policy "active clubs are public" on public.clubs for select
  using (archived_at is null or (select public.is_admin()));
create policy "admins create clubs" on public.clubs for insert to authenticated
  with check ((select public.is_admin()));
create policy "admins update clubs" on public.clubs for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "read own memberships" on public.club_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "join active clubs" on public.club_members for insert to authenticated
  with check (
    user_id = (select auth.uid()) and (select public.has_profile())
    and exists (select 1 from public.clubs c where c.id = club_id and c.archived_at is null)
  );
create policy "leave clubs" on public.club_members for delete to authenticated
  using (user_id = (select auth.uid()));

create view public.club_member_counts with (security_invoker = false) as
  select c.id as club_id, count(m.user_id)::integer as member_count
    from public.clubs c left join public.club_members m on m.club_id = c.id
   where c.archived_at is null
   group by c.id;
revoke all on public.club_member_counts from anon;
grant select on public.club_member_counts to authenticated;
