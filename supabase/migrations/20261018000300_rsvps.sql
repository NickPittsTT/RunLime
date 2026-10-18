-- Phase 3, slice 2: RSVPs (Going / Maybe / Not going) with group counts, "My races", public "N going".
-- Children appear only as a number in an adult's RSVP (18+ rule). Organisers and admins see children as a total;
-- the public sees only the number of adults going. No one but the person sees an individual RSVP.

create type public.rsvp_status as enum ('going', 'maybe', 'not_going');

create table public.rsvps (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  status public.rsvp_status not null,
  adults smallint not null default 1 check (adults between 1 and 50),     -- including the person
  children smallint not null default 0 check (children between 0 and 50), -- under 18, with the group's adults
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index rsvps_event_idx on public.rsvps (event_id, status);
create trigger rsvps_updated_at before update on public.rsvps for each row execute function public.set_updated_at();
alter table public.rsvps enable row level security;
revoke all on public.rsvps from anon, authenticated;
grant select, delete on public.rsvps to authenticated;
create policy "own rsvps" on public.rsvps for select to authenticated using (user_id = (select auth.uid()));
create policy "delete own rsvps" on public.rsvps for delete to authenticated using (user_id = (select auth.uid()));

-- Trend data for organisers without any person in it: each change is stored as a delta per event.
create table public.rsvp_changes (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  changed_at timestamptz not null default now(),
  going_adults_delta integer not null default 0,
  going_children_delta integer not null default 0,
  maybe_delta integer not null default 0
);
create index rsvp_changes_event_idx on public.rsvp_changes (event_id, changed_at);
alter table public.rsvp_changes enable row level security; -- read only through rsvp_summary (organisers/admins)
revoke all on public.rsvp_changes from anon, authenticated;

create function public.record_rsvp_change() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  o_going int := case when tg_op <> 'INSERT' and old.status = 'going' then old.adults else 0 end;
  o_kids int := case when tg_op <> 'INSERT' and old.status = 'going' then old.children else 0 end;
  o_maybe int := case when tg_op <> 'INSERT' and old.status = 'maybe' then 1 else 0 end;
  n_going int := case when tg_op <> 'DELETE' and new.status = 'going' then new.adults else 0 end;
  n_kids int := case when tg_op <> 'DELETE' and new.status = 'going' then new.children else 0 end;
  n_maybe int := case when tg_op <> 'DELETE' and new.status = 'maybe' then 1 else 0 end;
begin
  if (n_going - o_going, n_kids - o_kids, n_maybe - o_maybe) <> (0, 0, 0) then
    insert into public.rsvp_changes (event_id, going_adults_delta, going_children_delta, maybe_delta)
    values (coalesce(new.event_id, old.event_id), n_going - o_going, n_kids - o_kids, n_maybe - o_maybe);
  end if;
  return null;
end;
$$;
create trigger rsvps_record_change after insert or update or delete on public.rsvps
  for each row execute function public.record_rsvp_change();

insert into public.app_settings (key, value, is_public, description) values
  ('rsvp.max_adults', '"10"', true, 'Most adults (including the person) one RSVP can include.'),
  ('rsvp.max_children', '"10"', true, 'Most children (under 18) one RSVP can include. Children are a number only, never names or ages.')
on conflict (key) do nothing;

-- Going / Maybe / Not going for a public, upcoming race. Group counts only matter for Going and Maybe.
create function public.set_rsvp(p_event uuid, p_status public.rsvp_status, p_adults integer default 1, p_children integer default 0)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_e public.events;
  v_adults int := coalesce(p_adults, 1);
  v_children int := coalesce(p_children, 0);
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select * into v_e from public.events where id = p_event;
  if not found or v_e.status not in ('published', 'postponed', 'cancelled') then
    raise exception 'Race not found' using errcode = 'P0002';
  end if;
  if p_status <> 'not_going' then
    if v_e.status = 'cancelled' then
      raise exception 'This race is cancelled' using errcode = '22023';
    end if;
    if v_e.starts_at < now() - interval '6 hours' then
      raise exception 'This race has already taken place' using errcode = '22023';
    end if;
    if v_adults < 1 or v_adults > public.setting_int('rsvp.max_adults', 10) then
      raise exception 'Adults in your group: 1 to %', public.setting_int('rsvp.max_adults', 10) using errcode = '22023';
    end if;
    if v_children < 0 or v_children > public.setting_int('rsvp.max_children', 10) then
      raise exception 'Children in your group: 0 to %', public.setting_int('rsvp.max_children', 10) using errcode = '22023';
    end if;
  else
    v_adults := 1;
    v_children := 0;
  end if;
  insert into public.rsvps (user_id, event_id, status, adults, children)
  values (v_uid, p_event, p_status, v_adults, v_children)
  on conflict (user_id, event_id) do update set status = excluded.status, adults = excluded.adults, children = excluded.children;
end;
$$;
revoke execute on function public.set_rsvp from public, anon;
grant execute on function public.set_rsvp to authenticated;

-- Public "N going" for calendar rows and race pages: adults going (incl. groups) and people who said Maybe.
create function public.rsvp_counts(p_events uuid[]) returns table (event_id uuid, going integer, maybe integer)
language sql stable security definer
set search_path = ''
as $$
  select e.id,
         coalesce(sum(r.adults) filter (where r.status = 'going'), 0)::int,
         (count(r.*) filter (where r.status = 'maybe'))::int
    from public.events e
    left join public.rsvps r on r.event_id = e.id
   where e.id = any (p_events) and e.status in ('published', 'postponed', 'cancelled')
   group by e.id
$$;
revoke execute on function public.rsvp_counts from public;
grant execute on function public.rsvp_counts to anon, authenticated;

-- Organiser / admin totals for one event, including the children total and a daily trend. No names, no ages.
create function public.rsvp_summary(p_event uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.can_edit_event(p_event)) then
    raise exception 'You cannot see this race''s RSVPs' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'going_people', (select count(*) from public.rsvps where event_id = p_event and status = 'going'),
    'going_adults', (select coalesce(sum(adults), 0) from public.rsvps where event_id = p_event and status = 'going'),
    'going_children', (select coalesce(sum(children), 0) from public.rsvps where event_id = p_event and status = 'going'),
    'maybe', (select count(*) from public.rsvps where event_id = p_event and status = 'maybe'),
    'not_going', (select count(*) from public.rsvps where event_id = p_event and status = 'not_going'),
    'trend', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'going_adults', d.ga, 'going_children', d.gc, 'maybe', d.m) order by d.day), '[]'::jsonb)
                from (select day,
                             sum(ga) over (order by day) as ga, sum(gc) over (order by day) as gc, sum(m) over (order by day) as m
                        from (select (c.changed_at at time zone e.timezone)::date as day,
                                     sum(c.going_adults_delta) as ga, sum(c.going_children_delta) as gc, sum(c.maybe_delta) as m
                                from public.rsvp_changes c join public.events e on e.id = c.event_id
                               where c.event_id = p_event
                               group by 1) per_day) d)
  );
end;
$$;
revoke execute on function public.rsvp_summary from public, anon;
grant execute on function public.rsvp_summary to authenticated;

-- ---------------------------------------------------------------------------
-- Data export: the person's RSVPs.
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
                                          'sign_in_methods', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb))
                  from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) - 'id' from public.profiles p where p.id = v_uid),
    'home_area', (select r.name from public.profiles p join public.regions r on r.id = p.home_region_id where p.id = v_uid),
    'preferences', (select jsonb_build_object(
                      'areas', (select coalesce(jsonb_agg(r.name order by r.name), '[]'::jsonb) from public.regions r where r.id = any (up.region_ids)),
                      'distances_km', to_jsonb(up.distance_km), 'onboarded_at', up.onboarded_at, 'updated_at', up.updated_at)
                      from public.user_preferences up where up.user_id = v_uid),
    'roles', (select coalesce(jsonb_agg(r.role), '[]'::jsonb) from public.user_roles r where r.user_id = v_uid),
    'consents', (select coalesce(jsonb_agg(jsonb_build_object('kind', c.kind, 'version', c.version, 'granted_at', c.granted_at, 'revoked_at', c.revoked_at)
                                           order by c.granted_at), '[]'::jsonb) from public.consents c where c.user_id = v_uid),
    'clubs', (select coalesce(jsonb_agg(jsonb_build_object('club', cl.name, 'joined_at', m.joined_at)), '[]'::jsonb)
                from public.club_members m join public.clubs cl on cl.id = m.club_id where m.user_id = v_uid),
    'organisations', (select coalesce(jsonb_agg(jsonb_build_object('name', o.name, 'role', m.role, 'status', o.status)), '[]'::jsonb)
                        from public.organisation_members m join public.organisations o on o.id = m.organisation_id where m.user_id = v_uid),
    'reports_sent', (select coalesce(jsonb_agg(jsonb_build_object('category', r.category, 'about', r.target_kind, 'details', r.details,
                                                                  'sent_at', r.created_at, 'status', r.status) order by r.created_at), '[]'::jsonb)
                       from public.reports r where r.reporter_id = v_uid),
    'rsvps', (select coalesce(jsonb_agg(jsonb_build_object('race', e.name, 'starts_at', e.starts_at, 'status', r.status, 'adults', r.adults,
                                                           'children', r.children, 'updated_at', r.updated_at) order by e.starts_at), '[]'::jsonb)
                from public.rsvps r join public.events e on e.id = r.event_id where r.user_id = v_uid)
  );
end;
$$;
