-- Phase 2: events end to end.
--   RunLime listings (admin-entered, fact-only, no organiser) next to organiser events;
--   validated write RPCs (no direct table writes); co-organisers; media + sponsors (organiser events only);
--   change history; race suggestions; duplicate detection; country bounds for start pins; Phase 2 settings.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Countries: a bounding box for start pins (validation; keeps Caribbean expansion data-driven)
-- ---------------------------------------------------------------------------
alter table public.countries
  add column min_lat double precision,
  add column max_lat double precision,
  add column min_lng double precision,
  add column max_lng double precision;
update public.countries set min_lat = 9.95, max_lat = 11.45, min_lng = -62.0, max_lng = -60.4 where code = 'TT';

-- ---------------------------------------------------------------------------
-- Events: listing source, route, provenance
-- ---------------------------------------------------------------------------
create type public.listing_source as enum ('organiser', 'runlime');

alter table public.events
  alter column organisation_id drop not null,
  add column listing_source public.listing_source not null default 'organiser',
  add column route jsonb,
  add column duplicated_from_id uuid references public.events (id) on delete set null,
  add column approved_by uuid references auth.users (id) on delete set null,
  add column submitted_at timestamptz,
  add column created_by uuid references auth.users (id) on delete set null,
  add constraint events_listing_source_check check (
    (listing_source = 'organiser' and organisation_id is not null)
    or (listing_source = 'runlime' and organisation_id is null and registration_url is not null)
  ),
  add constraint events_registration_url_check check (registration_url is null or registration_url ~* '^https?://[^\s]+$'),
  -- Route: GeoJSON-style array of [lng, lat] points, at most 2000.
  add constraint events_route_check check (
    route is null or (jsonb_typeof(route) = 'array' and jsonb_array_length(route) between 2 and 2000)
  );

create index events_starts_at_idx on public.events (starts_at);
create index events_name_trgm_idx on public.events using gin (name extensions.gin_trgm_ops);

-- Re-attach the audit trigger with the new non-personal columns.
drop trigger audit_events on public.events;
create trigger audit_events after insert or update or delete on public.events
  for each row execute function audit.capture('id',
    'id,organisation_id,listing_source,slug,name,starts_at,region_id,corporation_id,venue_name,status,status_reason,featured_until,fee_min,fee_max,walk_friendly,checkin_radius_m,published_at,duplicated_from_id', '');

-- ---------------------------------------------------------------------------
-- Co-organisers (per event)
-- ---------------------------------------------------------------------------
create table public.event_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'co_organiser' check (role = 'co_organiser'),
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (event_id, user_id)
);
alter table public.event_members enable row level security;
revoke all on public.event_members from anon, authenticated;
grant select on public.event_members to authenticated;

-- Who may edit an event: admins (MFA); members of the event's VERIFIED organisation; accepted co-organisers.
create function public.can_edit_event(p_event uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin()
      or exists (
        select 1 from public.events e
          join public.organisations o on o.id = e.organisation_id
          join public.organisation_members m on m.organisation_id = o.id
         where e.id = p_event and o.status = 'verified' and m.user_id = auth.uid())
      or exists (
        select 1 from public.event_members em
         where em.event_id = p_event and em.user_id = auth.uid() and em.accepted_at is not null)
$$;
revoke execute on function public.can_edit_event from public, anon;
grant execute on function public.can_edit_event to authenticated;

create function public.is_event_co_organiser(p_event uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.event_members em
                      where em.event_id = p_event and em.user_id = auth.uid() and em.accepted_at is not null) $$;
grant execute on function public.is_event_co_organiser to anon, authenticated;

create policy "co-organiser rows: self, editors, admins" on public.event_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.can_edit_event(event_id)));

-- Drafts are visible to accepted co-organisers too.
drop policy "public events are readable" on public.events;
create policy "public events are readable" on public.events for select
  using (
    status in ('published', 'postponed', 'cancelled')
    or (select public.is_org_member(organisation_id))
    or (select public.is_admin())
    or (select public.is_event_co_organiser(id))
  );

-- ---------------------------------------------------------------------------
-- Media and sponsors: organiser events only (no flyers/logos on RunLime listings)
-- ---------------------------------------------------------------------------
create type public.event_media_kind as enum ('flyer', 'route_map', 'gallery');

create table public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind public.event_media_kind not null,
  storage_path text not null unique check (char_length(storage_path) between 5 and 300),
  alt_text text not null check (char_length(btrim(alt_text)) between 3 and 300),
  sort smallint not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.event_sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  logo_path text,
  url text check (url is null or url ~* '^https?://[^\s]+$'),
  sort smallint not null default 0
);

create function public.reject_media_on_listings() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.events e where e.id = new.event_id and e.listing_source = 'runlime') then
    raise exception 'RunLime listings carry facts only: no flyers, photos, logos or sponsors' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger event_media_no_listing before insert or update on public.event_media
  for each row execute function public.reject_media_on_listings();
create trigger event_sponsors_no_listing before insert or update on public.event_sponsors
  for each row execute function public.reject_media_on_listings();

alter table public.event_media enable row level security;
alter table public.event_sponsors enable row level security;
revoke all on public.event_media, public.event_sponsors from anon, authenticated;
grant select on public.event_media, public.event_sponsors to anon, authenticated;
grant insert, update (alt_text, sort, kind), delete on public.event_media to authenticated;
grant insert, update (name, logo_path, url, sort), delete on public.event_sponsors to authenticated;

create policy "media follows event visibility" on public.event_media for select
  using (exists (select 1 from public.events e where e.id = event_id));
create policy "editors manage media" on public.event_media for all to authenticated
  using ((select public.can_edit_event(event_id))) with check ((select public.can_edit_event(event_id)));
create policy "sponsors follow event visibility" on public.event_sponsors for select
  using (exists (select 1 from public.events e where e.id = event_id));
create policy "editors manage sponsors" on public.event_sponsors for all to authenticated
  using ((select public.can_edit_event(event_id))) with check ((select public.can_edit_event(event_id)));

-- Storage bucket for event images (public read by URL; writes only by event editors, path = <event_id>/<file>).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-media', 'event-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "event editors upload media" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.can_edit_event(((storage.foldername(name))[1])::uuid)
  );
create policy "event editors delete media" on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.can_edit_event(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Change history (feeds "what changed" notifications in Phase 3)
-- ---------------------------------------------------------------------------
create table public.event_changes (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);
create index event_changes_event_idx on public.event_changes (event_id, changed_at desc);
alter table public.event_changes enable row level security;
revoke all on public.event_changes from anon, authenticated;
grant select on public.event_changes to anon, authenticated;
create policy "changes follow event visibility" on public.event_changes for select
  using (exists (select 1 from public.events e where e.id = event_id));

create function public.record_event_changes() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.starts_at is distinct from old.starts_at then
    insert into public.event_changes (event_id, field, old_value, new_value) values (new.id, 'starts_at', old.starts_at::text, new.starts_at::text);
  end if;
  if new.venue_name is distinct from old.venue_name then
    insert into public.event_changes (event_id, field, old_value, new_value) values (new.id, 'venue_name', old.venue_name, new.venue_name);
  end if;
  if new.start_lat is distinct from old.start_lat or new.start_lng is distinct from old.start_lng then
    insert into public.event_changes (event_id, field, old_value, new_value)
    values (new.id, 'start_location', old.start_lat || ',' || old.start_lng, new.start_lat || ',' || new.start_lng);
  end if;
  if new.status is distinct from old.status then
    insert into public.event_changes (event_id, field, old_value, new_value) values (new.id, 'status', old.status::text, new.status::text);
  end if;
  if new.registration_url is distinct from old.registration_url then
    insert into public.event_changes (event_id, field, old_value, new_value) values (new.id, 'registration_url', old.registration_url, new.registration_url);
  end if;
  return new;
end;
$$;
create trigger events_record_changes after update on public.events
  for each row execute function public.record_event_changes();

-- ---------------------------------------------------------------------------
-- Duplicate detection: same area, ±1 day, similar name → admin queue
-- ---------------------------------------------------------------------------
create table public.duplicate_candidates (
  event_id uuid not null references public.events (id) on delete cascade,
  other_event_id uuid not null references public.events (id) on delete cascade,
  similarity real not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (event_id, other_event_id),
  check (event_id <> other_event_id)
);
alter table public.duplicate_candidates enable row level security;
revoke all on public.duplicate_candidates from anon, authenticated;
grant select on public.duplicate_candidates to authenticated;
grant update (resolved_at) on public.duplicate_candidates to authenticated;
create policy "admins read duplicates" on public.duplicate_candidates for select to authenticated
  using ((select public.is_admin()));
create policy "admins resolve duplicates" on public.duplicate_candidates for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create function public.flag_duplicate_events() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_threshold real := coalesce((select (value #>> '{}')::real from public.app_settings where key = 'events.duplicate_similarity'), 0.6);
begin
  if new.status not in ('pending_approval', 'published', 'postponed') then
    return new;
  end if;
  insert into public.duplicate_candidates (event_id, other_event_id, similarity)
  select new.id, e.id, extensions.similarity(lower(new.name), lower(e.name))
    from public.events e
   where e.id <> new.id
     and e.region_id = new.region_id
     and e.status in ('pending_approval', 'published', 'postponed')
     and abs(extract(epoch from (e.starts_at - new.starts_at))) <= 86400
     and extensions.similarity(lower(new.name), lower(e.name)) >= v_threshold
  on conflict do nothing;
  return new;
end;
$$;
create trigger events_flag_duplicates after insert or update of name, starts_at, region_id, status on public.events
  for each row execute function public.flag_duplicate_events();

-- ---------------------------------------------------------------------------
-- Race suggestions ("suggest a race" in the app; admin queue A5)
-- ---------------------------------------------------------------------------
create type public.suggestion_status as enum ('pending', 'converted', 'dismissed');

create table public.race_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggested_by uuid references auth.users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 3 and 140),
  event_date date,
  location text check (location is null or char_length(location) <= 200),
  url text check (url is null or url ~* '^https?://[^\s]+$'),
  notes text check (notes is null or char_length(notes) <= 1000),
  status public.suggestion_status not null default 'pending',
  converted_event_id uuid references public.events (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.race_suggestions enable row level security;
revoke all on public.race_suggestions from anon, authenticated;
grant select on public.race_suggestions to authenticated;
create policy "own suggestions and admins" on public.race_suggestions for select to authenticated
  using (suggested_by = (select auth.uid()) or (select public.is_admin()));

create function public.suggest_race(p_name text, p_event_date date, p_location text, p_url text, p_notes text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.has_profile() then
    raise exception 'Complete your profile first' using errcode = '42501';
  end if;
  perform public.check_rate_limit('race_suggestion', public.setting_int('ratelimit.race_suggestions_per_day', 5), interval '1 day');
  insert into public.race_suggestions (suggested_by, name, event_date, location, url, notes)
  values (auth.uid(), btrim(p_name), p_event_date, nullif(btrim(p_location), ''), nullif(btrim(p_url), ''), nullif(btrim(p_notes), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.suggest_race from public, anon;
grant execute on function public.suggest_race to authenticated;

create function public.review_race_suggestion(p_id uuid, p_status public.suggestion_status, p_event uuid default null) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_status = 'pending' then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  update public.race_suggestions
     set status = p_status, converted_event_id = case when p_status = 'converted' then p_event end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  if not found then
    raise exception 'Suggestion not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.review_race_suggestion from public, anon;
grant execute on function public.review_race_suggestion to authenticated;

-- ---------------------------------------------------------------------------
-- Write RPCs for events
-- ---------------------------------------------------------------------------

-- Create (p_id null) or update an event. p_event fields:
--   listing_source ('organiser' | 'runlime'), organisation_id, name, description, starts_at (ISO), timezone,
--   region_id, corporation_id, venue_name, start_lat, start_lng, registration_url, registration_instructions,
--   package_collection, parking, contact_email, contact_phone, cause, charity_name, walk_friendly,
--   fee_min, fee_max, route ([[lng,lat],...]).
-- p_distances: [{"km": 5, "label": "5K"}, ...] (at least one).
create function public.save_event(p_id uuid, p_event jsonb, p_distances jsonb) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_source public.listing_source;
  v_org uuid;
  v_existing public.events;
  v_id uuid;
  v_slug text;
  v_starts timestamptz;
  v_lat double precision := (p_event ->> 'start_lat')::double precision;
  v_lng double precision := (p_event ->> 'start_lng')::double precision;
  v_country char(2);
  v_box public.countries;
  v_region uuid := (p_event ->> 'region_id')::uuid;
  v_name text := btrim(coalesce(p_event ->> 'name', ''));
  v_d jsonb;
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Sign in first' using errcode = '42501';
  end if;

  if p_id is not null then
    select * into v_existing from public.events where id = p_id;
    if not found then
      raise exception 'Event not found' using errcode = 'P0002';
    end if;
    if not public.can_edit_event(p_id) then
      raise exception 'You cannot edit this event' using errcode = '42501';
    end if;
    v_source := v_existing.listing_source;  -- source never changes on edit (claiming is an admin action)
    v_org := v_existing.organisation_id;
  else
    v_source := coalesce((p_event ->> 'listing_source')::public.listing_source, 'organiser');
    if v_source = 'runlime' then
      if not v_admin then
        raise exception 'Only admins can create RunLime listings' using errcode = '42501';
      end if;
      v_org := null;
    else
      v_org := (p_event ->> 'organisation_id')::uuid;
      if v_org is null then
        raise exception 'Choose the organisation' using errcode = '22023';
      end if;
      if not v_admin and not exists (
        select 1 from public.organisations o join public.organisation_members m on m.organisation_id = o.id
         where o.id = v_org and o.status = 'verified' and m.user_id = v_uid) then
        raise exception 'Only members of a verified organisation can create events' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Validation
  if char_length(v_name) < 3 or char_length(v_name) > 140 then
    raise exception 'Event name must be 3 to 140 characters' using errcode = '22023';
  end if;
  begin
    v_starts := (p_event ->> 'starts_at')::timestamptz;
  exception when others then
    raise exception 'Invalid start date/time' using errcode = '22023';
  end;
  if v_starts is null then
    raise exception 'Start date and time are required' using errcode = '22023';
  end if;
  if p_id is null and v_starts < now() and not v_admin then
    raise exception 'The start time is in the past' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_event ->> 'venue_name', ''))) < 2 then
    raise exception 'Venue is required' using errcode = '22023';
  end if;
  select r.country_code into v_country from public.regions r where r.id = v_region and r.kind = 'area';
  if v_country is null then
    raise exception 'Choose an area' using errcode = '22023';
  end if;
  select * into v_box from public.countries where code = v_country;
  if v_lat is null or v_lng is null then
    raise exception 'Place the start pin on the map' using errcode = '22023';
  end if;
  if v_box.min_lat is not null and not (v_lat between v_box.min_lat and v_box.max_lat and v_lng between v_box.min_lng and v_box.max_lng) then
    raise exception 'The start pin is outside %', v_box.name using errcode = '22023';
  end if;
  if v_source = 'runlime' and coalesce(btrim(p_event ->> 'registration_url'), '') = '' then
    raise exception 'RunLime listings need the official registration link' using errcode = '22023';
  end if;
  if p_distances is null or jsonb_typeof(p_distances) <> 'array' or jsonb_array_length(p_distances) = 0 then
    raise exception 'Add at least one distance' using errcode = '22023';
  end if;

  if p_id is null then
    v_slug := public.slugify(v_name) || '-' || to_char(v_starts at time zone coalesce(p_event ->> 'timezone', 'America/Port_of_Spain'), 'YYYY');
    if exists (select 1 from public.events where slug = v_slug) then
      v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    end if;
    insert into public.events (
      organisation_id, listing_source, slug, name, description, starts_at, timezone, country_code, region_id, corporation_id,
      venue_name, start_lat, start_lng, registration_url, registration_instructions, package_collection, parking,
      contact_email, contact_phone, cause, charity_name, walk_friendly, fee_min, fee_max, currency, route, status, created_by)
    values (
      v_org, v_source, v_slug, v_name, coalesce(p_event ->> 'description', ''), v_starts,
      coalesce(p_event ->> 'timezone', 'America/Port_of_Spain'), v_country, v_region, (p_event ->> 'corporation_id')::uuid,
      btrim(p_event ->> 'venue_name'), v_lat, v_lng, nullif(btrim(p_event ->> 'registration_url'), ''),
      nullif(btrim(p_event ->> 'registration_instructions'), ''), nullif(btrim(p_event ->> 'package_collection'), ''),
      nullif(btrim(p_event ->> 'parking'), ''), nullif(btrim(p_event ->> 'contact_email'), ''), nullif(btrim(p_event ->> 'contact_phone'), ''),
      nullif(btrim(p_event ->> 'cause'), ''), nullif(btrim(p_event ->> 'charity_name'), ''),
      coalesce((p_event ->> 'walk_friendly')::boolean, false), coalesce((p_event ->> 'fee_min')::numeric, 0), (p_event ->> 'fee_max')::numeric,
      (select c.currency from public.countries c where c.code = v_country), nullif(p_event -> 'route', 'null'::jsonb), 'draft', v_uid)
    returning id into v_id;
  else
    update public.events set
      name = v_name, description = coalesce(p_event ->> 'description', ''), starts_at = v_starts,
      timezone = coalesce(p_event ->> 'timezone', timezone), country_code = v_country, region_id = v_region,
      corporation_id = (p_event ->> 'corporation_id')::uuid, venue_name = btrim(p_event ->> 'venue_name'),
      start_lat = v_lat, start_lng = v_lng, registration_url = nullif(btrim(p_event ->> 'registration_url'), ''),
      registration_instructions = nullif(btrim(p_event ->> 'registration_instructions'), ''),
      package_collection = nullif(btrim(p_event ->> 'package_collection'), ''), parking = nullif(btrim(p_event ->> 'parking'), ''),
      contact_email = nullif(btrim(p_event ->> 'contact_email'), ''), contact_phone = nullif(btrim(p_event ->> 'contact_phone'), ''),
      cause = nullif(btrim(p_event ->> 'cause'), ''), charity_name = nullif(btrim(p_event ->> 'charity_name'), ''),
      walk_friendly = coalesce((p_event ->> 'walk_friendly')::boolean, false),
      fee_min = coalesce((p_event ->> 'fee_min')::numeric, 0), fee_max = (p_event ->> 'fee_max')::numeric,
      route = nullif(p_event -> 'route', 'null'::jsonb)
    where id = p_id;
    v_id := p_id;
    delete from public.event_distances where event_id = v_id;
  end if;

  for v_d in select * from jsonb_array_elements(p_distances) loop
    insert into public.event_distances (event_id, distance_km, label)
    values (v_id, (v_d ->> 'km')::numeric, coalesce(nullif(btrim(v_d ->> 'label'), ''), (v_d ->> 'km') || 'K'));
  end loop;
  return v_id;
end;
$$;
revoke execute on function public.save_event from public, anon;
grant execute on function public.save_event to authenticated;

-- Organiser submits a draft for approval (or it publishes at once when auto-publish is on for verified organisers).
create function public.submit_event(p_id uuid) returns public.event_status
language plpgsql security definer
set search_path = ''
as $$
declare
  v_e public.events;
  v_auto boolean := coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'events.auto_publish_verified'), false);
  v_next public.event_status;
begin
  select * into v_e from public.events where id = p_id;
  if not found or not public.can_edit_event(p_id) then
    raise exception 'You cannot submit this event' using errcode = '42501';
  end if;
  if v_e.status not in ('draft', 'rejected', 'unpublished') then
    raise exception 'Only drafts can be submitted' using errcode = '22023';
  end if;
  v_next := case when v_auto and v_e.listing_source = 'organiser' then 'published' else 'pending_approval' end;
  update public.events
     set status = v_next, submitted_at = now(), status_reason = null,
         published_at = case when v_next = 'published' then now() else published_at end
   where id = p_id;
  return v_next;
end;
$$;
revoke execute on function public.submit_event from public, anon;
grant execute on function public.submit_event to authenticated;

-- Admin decision: publish, reject (reason), unpublish (reason).
create function public.review_event(p_id uuid, p_decision public.event_status, p_reason text default null) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_decision not in ('published', 'rejected', 'unpublished') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  if p_decision in ('rejected', 'unpublished') and char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  update public.events
     set status = p_decision,
         status_reason = case when p_decision = 'published' then null else btrim(p_reason) end,
         published_at = case when p_decision = 'published' then coalesce(published_at, now()) else published_at end,
         approved_by = case when p_decision = 'published' then auth.uid() else approved_by end
   where id = p_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.review_event from public, anon;
grant execute on function public.review_event to authenticated;

-- Postpone / cancel / reinstate a live event. Reason required; postponing may set a new start.
create function public.change_event_status(p_id uuid, p_status public.event_status, p_reason text, p_new_starts_at timestamptz default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_e public.events;
begin
  select * into v_e from public.events where id = p_id;
  if not found or not public.can_edit_event(p_id) then
    raise exception 'You cannot change this event' using errcode = '42501';
  end if;
  if p_status not in ('postponed', 'cancelled', 'published') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  if v_e.status not in ('published', 'postponed') then
    raise exception 'Only live events can be postponed, cancelled or reinstated' using errcode = '22023';
  end if;
  if p_status in ('postponed', 'cancelled') and char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Tell runners why (at least a few words)' using errcode = '22023';
  end if;
  update public.events
     set status = p_status,
         status_reason = case when p_status = 'published' then null else btrim(p_reason) end,
         starts_at = coalesce(p_new_starts_at, starts_at)
   where id = p_id;
end;
$$;
revoke execute on function public.change_event_status from public, anon;
grant execute on function public.change_event_status to authenticated;

-- Duplicate an event (e.g. next year's edition) as a new draft.
create function public.duplicate_event(p_id uuid, p_new_starts_at timestamptz) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_e public.events;
  v_new uuid;
  v_slug text;
begin
  select * into v_e from public.events where id = p_id;
  if not found or not public.can_edit_event(p_id) then
    raise exception 'You cannot duplicate this event' using errcode = '42501';
  end if;
  if p_new_starts_at is null then
    raise exception 'Choose the new date' using errcode = '22023';
  end if;
  v_slug := public.slugify(v_e.name) || '-' || to_char(p_new_starts_at at time zone v_e.timezone, 'YYYY');
  if exists (select 1 from public.events where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;
  insert into public.events (
    organisation_id, listing_source, slug, name, description, starts_at, timezone, country_code, region_id, corporation_id,
    venue_name, start_lat, start_lng, registration_url, registration_instructions, package_collection, parking,
    contact_email, contact_phone, cause, charity_name, walk_friendly, fee_min, fee_max, currency, route,
    checkin_radius_m, status, duplicated_from_id, created_by)
  select organisation_id, listing_source, v_slug, name, description, p_new_starts_at, timezone, country_code, region_id, corporation_id,
    venue_name, start_lat, start_lng, registration_url, registration_instructions, package_collection, parking,
    contact_email, contact_phone, cause, charity_name, walk_friendly, fee_min, fee_max, currency, route,
    checkin_radius_m, 'draft', id, auth.uid()
    from public.events where id = p_id
  returning id into v_new;
  insert into public.event_distances (event_id, distance_km, label)
  select v_new, distance_km, label from public.event_distances where event_id = p_id;
  insert into public.event_sponsors (event_id, name, logo_path, url, sort)
  select v_new, name, logo_path, url, sort from public.event_sponsors where event_id = p_id;
  return v_new;
end;
$$;
revoke execute on function public.duplicate_event from public, anon;
grant execute on function public.duplicate_event to authenticated;

-- Co-organisers: invite an existing RunLime account by email; they accept; editors can remove.
create function public.invite_co_organiser(p_event uuid, p_email text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.can_edit_event(p_event) then
    raise exception 'You cannot manage this event' using errcode = '42501';
  end if;
  if exists (select 1 from public.events where id = p_event and listing_source = 'runlime') then
    raise exception 'RunLime listings have no co-organisers' using errcode = '22023';
  end if;
  perform public.check_rate_limit('co_organiser_invite', 20, interval '1 day');
  select u.id into v_user from auth.users u join public.profiles p on p.id = u.id where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No RunLime account uses that email. Ask them to sign up first.' using errcode = 'P0002';
  end if;
  insert into public.event_members (event_id, user_id, invited_by) values (p_event, v_user, auth.uid())
  on conflict do nothing;
end;
$$;
create function public.accept_co_organiser(p_event uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.event_members set accepted_at = now()
   where event_id = p_event and user_id = auth.uid() and accepted_at is null;
  if not found then
    raise exception 'No invitation found' using errcode = 'P0002';
  end if;
end;
$$;
create function public.remove_co_organiser(p_event uuid, p_user uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_user <> auth.uid() and not public.can_edit_event(p_event) then
    raise exception 'You cannot manage this event' using errcode = '42501';
  end if;
  delete from public.event_members where event_id = p_event and user_id = p_user;
end;
$$;
revoke execute on function public.invite_co_organiser, public.accept_co_organiser, public.remove_co_organiser from public, anon;
grant execute on function public.invite_co_organiser, public.accept_co_organiser, public.remove_co_organiser to authenticated;

-- ---------------------------------------------------------------------------
-- Phase 2 settings
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, is_public, description) values
  ('events.unaffiliated_notice',
   '"Listed by RunLime from public information. RunLime is not affiliated with this event or its organiser. Check the details, and register, with the organiser."',
   true, 'Shown on every RunLime listing (admin-entered race) in the app and on the web.'),
  ('events.duplicate_similarity', '0.6', false, 'Name similarity (0–1) above which events in the same area within a day are flagged as possible duplicates.'),
  ('ratelimit.race_suggestions_per_day', '5', false, 'Race suggestions one person can send per day.'),
  ('calendar.near_me_radius_km', '25', true, 'Default radius for "Near me" in the app.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Organisation settings (O15): edit details; owners add/remove members
-- ---------------------------------------------------------------------------
create function public.update_organisation(p_org uuid, p_contact_email text, p_contact_phone text, p_website text, p_about text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_org_member(p_org) and not public.is_admin() then
    raise exception 'You cannot edit this organisation' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_about, ''))) < 20 then
    raise exception 'Tell us a little more about the organisation' using errcode = '22023';
  end if;
  if coalesce(btrim(p_contact_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid contact email' using errcode = '22023';
  end if;
  update public.organisations
     set contact_email = btrim(p_contact_email), contact_phone = btrim(p_contact_phone),
         website = nullif(btrim(p_website), ''), about = btrim(p_about)
   where id = p_org;
end;
$$;

create function public.is_org_owner(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.organisation_members m where m.organisation_id = p_org and m.user_id = auth.uid() and m.role = 'owner') $$;

create function public.add_organisation_member(p_org uuid, p_email text, p_role public.organisation_member_role default 'manager')
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.is_org_owner(p_org) and not public.is_admin() then
    raise exception 'Only the organisation owner can add members' using errcode = '42501';
  end if;
  perform public.check_rate_limit('org_member_add', 20, interval '1 day');
  select u.id into v_user from auth.users u join public.profiles p on p.id = u.id where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No RunLime account uses that email. Ask them to sign up first.' using errcode = 'P0002';
  end if;
  insert into public.organisation_members (organisation_id, user_id, role) values (p_org, v_user, p_role)
  on conflict (organisation_id, user_id) do update set role = excluded.role;
  if exists (select 1 from public.organisations where id = p_org and status = 'verified') then
    insert into public.user_roles (user_id, role) values (v_user, 'organiser') on conflict do nothing;
  end if;
end;
$$;

create function public.remove_organisation_member(p_org uuid, p_user uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_org_owner(p_org) and not public.is_admin() and p_user <> auth.uid() then
    raise exception 'Only the organisation owner can remove members' using errcode = '42501';
  end if;
  if (select role from public.organisation_members where organisation_id = p_org and user_id = p_user) = 'owner'
     and (select count(*) from public.organisation_members where organisation_id = p_org and role = 'owner') = 1 then
    raise exception 'An organisation needs at least one owner' using errcode = '22023';
  end if;
  delete from public.organisation_members where organisation_id = p_org and user_id = p_user;
  delete from public.user_roles r
   where r.user_id = p_user and r.role = 'organiser'
     and not exists (select 1 from public.organisation_members m join public.organisations o on o.id = m.organisation_id
                      where m.user_id = p_user and o.status = 'verified');
end;
$$;
revoke execute on function public.update_organisation, public.is_org_owner, public.add_organisation_member, public.remove_organisation_member from public, anon;
grant execute on function public.update_organisation, public.is_org_owner, public.add_organisation_member, public.remove_organisation_member to authenticated;

-- Team lists show display names to teammates only (profiles are otherwise owner-only).
create function public.organisation_team(p_org uuid)
returns table (user_id uuid, display_name text, role public.organisation_member_role)
language sql stable security definer
set search_path = ''
as $$
  select m.user_id, p.display_name, m.role
    from public.organisation_members m join public.profiles p on p.id = m.user_id
   where m.organisation_id = p_org and (public.is_org_member(p_org) or public.is_admin())
   order by m.role, p.display_name
$$;
create function public.event_team(p_event uuid)
returns table (user_id uuid, display_name text, accepted boolean)
language sql stable security definer
set search_path = ''
as $$
  select em.user_id, p.display_name, em.accepted_at is not null
    from public.event_members em join public.profiles p on p.id = em.user_id
   where em.event_id = p_event and public.can_edit_event(p_event)
   order by p.display_name
$$;
revoke execute on function public.organisation_team, public.event_team from public, anon;
grant execute on function public.organisation_team, public.event_team to authenticated;
