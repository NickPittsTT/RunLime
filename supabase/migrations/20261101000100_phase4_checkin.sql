-- Phase 4: GPS check-in (owner decisions 31 Oct 2026; requirements in PROGRESS.md "Phase 4 notes").
-- check_in(event, lat, lng, accuracy): one per user per event, inside the window and the radius of the start pin (or
-- the optional finish pin). Failed attempts are kept (rounded to 3 dp) for 30 days so a pin correction can approve
-- them later; "I'm here but can't check in" goes to an admin queue; admins can approve manually with a reason.

alter type public.notification_kind add value if not exists 'checkin_update';

-- ---------------------------------------------------------------------------
-- Settings (owner: 500 m; 1 h before to 3 h after; 30 days)
-- ---------------------------------------------------------------------------
update public.app_settings set value = '60', description = 'Check-in opens this many minutes before the start (follows a postponed race''s new date).' where key = 'checkin.window_before_min';
update public.app_settings set value = '180', description = 'Check-in closes this many minutes after the start.' where key = 'checkin.window_after_min';
update public.app_settings set value = '500', description = 'Default GPS check-in radius in metres (admins may override per event).' where key = 'checkin.radius_m';
insert into public.app_settings (key, value, is_public, description) values
  ('checkin.accuracy_allowance_max_m', '100', true, 'The phone''s reported GPS accuracy is allowed for up to this many metres when checking the radius.'),
  ('checkin.failed_retention_days', '30', false, 'Failed check-in attempts (location rounded to 3 decimal places) are deleted after this many days.'),
  ('checkin.max_attempts_per_day', '20', false, 'Check-in attempts allowed per person per race per day.'),
  ('checkin.pin_warning_distance_m', '1000', true, 'Warn when the start pin is further than this from the address found by the venue search.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Events: optional finish pin, pin confirmations, venue search result
-- ---------------------------------------------------------------------------
alter table public.events
  add column finish_lat double precision check (finish_lat is null or finish_lat between -90 and 90),
  add column finish_lng double precision check (finish_lng is null or finish_lng between -180 and 180),
  add column pin_start_line_at timestamptz,
  add column pin_start_line_by uuid references auth.users (id) on delete set null,
  add column pin_checked_at timestamptz,
  add column pin_checked_by uuid references auth.users (id) on delete set null,
  add column geocode_precision text check (geocode_precision is null or geocode_precision in ('exact', 'street', 'town')),
  add column geocoded_lat double precision,
  add column geocoded_lng double precision,
  add constraint events_finish_pin_pair check ((finish_lat is null) = (finish_lng is null));

-- Moving a pin clears its confirmations (they must be given again for the new position).
create function public.clear_pin_confirmations() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.start_lat is distinct from old.start_lat or new.start_lng is distinct from old.start_lng then
    new.pin_start_line_at := null; new.pin_start_line_by := null;
    new.pin_checked_at := null; new.pin_checked_by := null;
  end if;
  return new;
end $$;
revoke execute on function public.clear_pin_confirmations() from public, anon, authenticated;
create trigger events_clear_pin_confirmations before update of start_lat, start_lng on public.events
  for each row execute function public.clear_pin_confirmations();

-- Great-circle distance in metres.
create function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe set search_path = '' as $$
  select 2 * 6371008.8 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  method text not null default 'gps' check (method = 'gps'),
  status text not null default 'gps' check (status in ('gps', 'approved_after_correction', 'manual')),
  lat numeric(8, 3),
  lng numeric(8, 3),
  accuracy_m integer,
  distance_m integer,
  approved_by uuid references auth.users (id) on delete set null,
  reason text,
  checked_in_at timestamptz not null default now(),
  unique (user_id, event_id)
);
create index check_ins_event_idx on public.check_ins (event_id);
alter table public.check_ins enable row level security;
create policy "own check-ins: read" on public.check_ins for select to authenticated using (user_id = (select auth.uid()));
grant select on public.check_ins to authenticated;

create table public.checkin_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  lat numeric(8, 3),
  lng numeric(8, 3),
  accuracy_m integer,
  distance_m integer,
  reason text not null check (reason in ('too_far', 'too_early', 'too_late', 'not_live')),
  resolved_check_in_id uuid references public.check_ins (id) on delete set null,
  created_at timestamptz not null default now()
);
create index checkin_attempts_event_idx on public.checkin_attempts (event_id, created_at);
create index checkin_attempts_user_idx on public.checkin_attempts (user_id, event_id, created_at);
alter table public.checkin_attempts enable row level security;
create policy "own attempts: read" on public.checkin_attempts for select to authenticated using (user_id = (select auth.uid()));
grant select on public.checkin_attempts to authenticated;

create table public.checkin_help_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  attempt_id uuid references public.checkin_attempts (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references auth.users (id) on delete set null,
  decision_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index checkin_help_one_open on public.checkin_help_requests (user_id, event_id) where status = 'pending';
alter table public.checkin_help_requests enable row level security;
create policy "own help requests: read" on public.checkin_help_requests for select to authenticated using (user_id = (select auth.uid()));
grant select on public.checkin_help_requests to authenticated;

-- Saved venues: confirmed pins that can be reused for the next race at the same place.
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  region_id uuid references public.regions (id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz not null default now(),
  from_event_id uuid references public.events (id) on delete set null
);
create unique index venues_name_region on public.venues (lower(btrim(name)), coalesce(region_id, '00000000-0000-0000-0000-000000000000'));
alter table public.venues enable row level security;
-- No direct access; read through search_venues().

create trigger audit_check_ins after insert or update or delete on public.check_ins
  for each row execute function audit.capture('user_id', 'id,event_id,status,approved_by,checked_in_at', '');
create trigger audit_checkin_help after insert or update or delete on public.checkin_help_requests
  for each row execute function audit.capture('user_id', 'id,event_id,status,decided_at', '');

-- ---------------------------------------------------------------------------
-- The check itself (shared by check_in and the re-test after a pin change)
-- ---------------------------------------------------------------------------
create function public.checkin_evaluate(p_event uuid, p_lat double precision, p_lng double precision, p_accuracy double precision, p_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_e public.events;
  v_radius int; v_opens timestamptz; v_closes timestamptz; v_allow double precision; v_dist double precision;
begin
  select * into v_e from public.events where id = p_event;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  v_radius := coalesce(v_e.checkin_radius_m, public.setting_int('checkin.radius_m', 500));
  v_opens := v_e.starts_at - make_interval(mins => public.setting_int('checkin.window_before_min', 60));
  v_closes := v_e.starts_at + make_interval(mins => public.setting_int('checkin.window_after_min', 180));
  v_dist := public.distance_m(p_lat, p_lng, v_e.start_lat, v_e.start_lng);
  if v_e.finish_lat is not null then
    v_dist := least(v_dist, public.distance_m(p_lat, p_lng, v_e.finish_lat, v_e.finish_lng));
  end if;
  v_allow := least(greatest(coalesce(p_accuracy, 0), 0), public.setting_int('checkin.accuracy_allowance_max_m', 100));
  return jsonb_build_object(
    'result', case
      -- Live: published, or postponed to a known new date (starts_at is the new date; original_starts_at is set).
      when not (v_e.status = 'published' or (v_e.status = 'postponed' and v_e.original_starts_at is not null)) then 'not_live'
      when p_at < v_opens then 'too_early'
      when p_at > v_closes then 'too_late'
      when v_dist - v_allow > v_radius then 'too_far'
      else 'ok' end,
    'distance_m', round(v_dist)::int, 'radius_m', v_radius, 'opens_at', v_opens, 'closes_at', v_closes, 'event_name', v_e.name);
end $$;
revoke execute on function public.checkin_evaluate(uuid, double precision, double precision, double precision, timestamptz) from public, anon, authenticated;

create function public.check_in(p_event uuid, p_lat double precision, p_lng double precision, p_accuracy_m double precision)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_eval jsonb; v_result text; v_existing public.check_ins; v_id uuid; v_attempt uuid;
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Location not available' using errcode = '22023';
  end if;
  select * into v_existing from public.check_ins where user_id = v_uid and event_id = p_event;
  if found then
    return jsonb_build_object('result', 'already', 'checked_in_at', v_existing.checked_in_at);
  end if;
  if (select count(*) from public.checkin_attempts where user_id = v_uid and event_id = p_event and created_at > now() - interval '1 day')
     >= public.setting_int('checkin.max_attempts_per_day', 20) then
    raise exception 'Too many check-in attempts for this race today. Use "I''m here but can''t check in".' using errcode = 'P0429';
  end if;
  v_eval := public.checkin_evaluate(p_event, p_lat, p_lng, p_accuracy_m, now());
  v_result := v_eval ->> 'result';
  if v_result = 'not_found' then
    raise exception 'Race not found' using errcode = 'P0002';
  end if;
  if v_result = 'ok' then
    insert into public.check_ins (user_id, event_id, lat, lng, accuracy_m, distance_m)
    values (v_uid, p_event, round(p_lat::numeric, 3), round(p_lng::numeric, 3), round(p_accuracy_m)::int, (v_eval ->> 'distance_m')::int)
    returning id into v_id;
    return v_eval || jsonb_build_object('check_in_id', v_id);
  end if;
  insert into public.checkin_attempts (user_id, event_id, lat, lng, accuracy_m, distance_m, reason)
  values (v_uid, p_event, round(p_lat::numeric, 3), round(p_lng::numeric, 3), round(p_accuracy_m)::int, (v_eval ->> 'distance_m')::int, v_result)
  returning id into v_attempt;
  return v_eval || jsonb_build_object('attempt_id', v_attempt);
end $$;
revoke execute on function public.check_in(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.check_in(uuid, double precision, double precision, double precision) to authenticated;

-- "I'm here but can't check in"
create function public.request_checkin_help(p_event uuid, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_attempt uuid; v_id uuid;
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if exists (select 1 from public.check_ins where user_id = v_uid and event_id = p_event) then
    raise exception 'You are already checked in' using errcode = '22023';
  end if;
  select id into v_attempt from public.checkin_attempts where user_id = v_uid and event_id = p_event order by created_at desc limit 1;
  if v_attempt is null then
    raise exception 'Try "Check in" first, so we can see where your phone placed you' using errcode = '22023';
  end if;
  select id into v_id from public.checkin_help_requests where user_id = v_uid and event_id = p_event and status = 'pending';
  if v_id is not null then
    return v_id;
  end if;
  insert into public.checkin_help_requests (user_id, event_id, attempt_id, note)
  values (v_uid, p_event, v_attempt, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.request_checkin_help(uuid, text) from public, anon;
grant execute on function public.request_checkin_help(uuid, text) to authenticated;

-- What the app shows on the race page.
create function public.my_checkin_status(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_e public.events; v_c public.check_ins; v_help text;
begin
  select * into v_e from public.events where id = p_event;
  if not found then
    raise exception 'Race not found' using errcode = 'P0002';
  end if;
  select * into v_c from public.check_ins where user_id = v_uid and event_id = p_event;
  select status into v_help from public.checkin_help_requests where user_id = v_uid and event_id = p_event order by created_at desc limit 1;
  return jsonb_build_object(
    'checked_in', v_c.id is not null, 'checked_in_at', v_c.checked_in_at, 'check_in_status', v_c.status,
    'opens_at', v_e.starts_at - make_interval(mins => public.setting_int('checkin.window_before_min', 60)),
    'closes_at', v_e.starts_at + make_interval(mins => public.setting_int('checkin.window_after_min', 180)),
    'radius_m', coalesce(v_e.checkin_radius_m, public.setting_int('checkin.radius_m', 500)),
    'live', v_e.status = 'published' or (v_e.status = 'postponed' and v_e.original_starts_at is not null),
    'help_request', v_help);
end $$;
revoke execute on function public.my_checkin_status(uuid) from public, anon;
grant execute on function public.my_checkin_status(uuid) to authenticated;

-- Organisers and admins: how many checked in (no names).
create function public.event_checkin_count(p_event uuid) returns integer
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or public.can_edit_event(p_event)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return (select count(*)::int from public.check_ins where event_id = p_event);
end $$;
revoke execute on function public.event_checkin_count(uuid) from public, anon;
grant execute on function public.event_checkin_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin queue and decisions
-- ---------------------------------------------------------------------------
create function public.admin_checkin_queue(p_event uuid default null)
returns table (kind text, id uuid, event_id uuid, event_name text, user_id uuid, display_name text, created_at timestamptz,
               reason text, distance_m integer, accuracy_m integer, note text, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select 'help'::text, h.id, h.event_id, e.name, h.user_id, p.display_name, h.created_at,
           a.reason, a.distance_m, a.accuracy_m, h.note, h.status
      from public.checkin_help_requests h
      join public.events e on e.id = h.event_id
      join public.profiles p on p.id = h.user_id
      left join public.checkin_attempts a on a.id = h.attempt_id
     where h.status = 'pending' and (p_event is null or h.event_id = p_event)
    union all
    select 'attempt'::text, a.id, a.event_id, e.name, a.user_id, p.display_name, a.created_at,
           a.reason, a.distance_m, a.accuracy_m, null::text, case when a.resolved_check_in_id is null then 'failed' else 'resolved' end
      from public.checkin_attempts a
      join public.events e on e.id = a.event_id
      join public.profiles p on p.id = a.user_id
     where p_event is not null and a.event_id = p_event
     order by 7 desc;
end $$;
revoke execute on function public.admin_checkin_queue(uuid) from public, anon;
grant execute on function public.admin_checkin_queue(uuid) to authenticated;

create function public.admin_approve_checkin(p_user uuid, p_event uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_name text;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  select name into v_name from public.events where id = p_event;
  if v_name is null then
    raise exception 'Race not found' using errcode = 'P0002';
  end if;
  perform set_config('runlime.audit_reason', btrim(p_reason), true);
  insert into public.check_ins (user_id, event_id, status, approved_by, reason)
  values (p_user, p_event, 'manual', auth.uid(), btrim(p_reason))
  on conflict (user_id, event_id) do nothing
  returning id into v_id;
  update public.checkin_help_requests set status = 'approved', decided_by = auth.uid(), decided_at = now(), decision_reason = btrim(p_reason)
   where user_id = p_user and event_id = p_event and status = 'pending';
  if v_id is not null then
    perform public.notify(p_user, 'checkin_update', 'You''re checked in: ' || v_name, 'A RunLime admin confirmed your check-in.', jsonb_build_object('event_id', p_event));
  end if;
  return v_id;
end $$;
revoke execute on function public.admin_approve_checkin(uuid, uuid, text) from public, anon;
grant execute on function public.admin_approve_checkin(uuid, uuid, text) to authenticated;

create function public.admin_decline_checkin_help(p_request uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r public.checkin_help_requests; v_name text;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  perform set_config('runlime.audit_reason', btrim(p_reason), true);
  update public.checkin_help_requests set status = 'declined', decided_by = auth.uid(), decided_at = now(), decision_reason = btrim(p_reason)
   where id = p_request and status = 'pending' returning * into v_r;
  if v_r.id is null then
    raise exception 'Request not found or already decided' using errcode = 'P0002';
  end if;
  select name into v_name from public.events where id = v_r.event_id;
  perform public.notify(v_r.user_id, 'checkin_update', 'Check-in not confirmed: ' || v_name, btrim(p_reason), jsonb_build_object('event_id', v_r.event_id));
end $$;
revoke execute on function public.admin_decline_checkin_help(uuid, text) from public, anon;
grant execute on function public.admin_decline_checkin_help(uuid, text) to authenticated;

-- After a pin or radius change: re-test the race's failed "too far" attempts (made inside the window) against the
-- corrected pin/radius. Passes become check-ins "approved after correction" (audit-logged) and the runner is told.
create function public.retest_failed_checkins(p_event uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; v_eval jsonb; v_id uuid; v_n int := 0; v_name text;
begin
  select name into v_name from public.events where id = p_event;
  perform set_config('runlime.audit_reason', 'Pin or radius corrected: failed attempt re-tested', true);
  for r in select distinct on (a.user_id) a.* from public.checkin_attempts a
            where a.event_id = p_event and a.reason = 'too_far' and a.resolved_check_in_id is null
              and not exists (select 1 from public.check_ins c where c.user_id = a.user_id and c.event_id = p_event)
            order by a.user_id, a.distance_m loop
    v_eval := public.checkin_evaluate(p_event, r.lat::double precision, r.lng::double precision, r.accuracy_m, r.created_at);
    if v_eval ->> 'result' = 'ok' then
      insert into public.check_ins (user_id, event_id, status, lat, lng, accuracy_m, distance_m, reason, checked_in_at)
      values (r.user_id, p_event, 'approved_after_correction', r.lat, r.lng, r.accuracy_m, (v_eval ->> 'distance_m')::int,
              'Approved after the race pin or radius was corrected', r.created_at)
      on conflict (user_id, event_id) do nothing returning id into v_id;
      if v_id is not null then
        update public.checkin_attempts set resolved_check_in_id = v_id where event_id = p_event and user_id = r.user_id and resolved_check_in_id is null;
        update public.checkin_help_requests set status = 'approved', decided_at = now(), decision_reason = 'Approved after the race pin or radius was corrected'
         where user_id = r.user_id and event_id = p_event and status = 'pending';
        perform public.notify(r.user_id, 'checkin_update', 'You''re checked in: ' || v_name, 'The race pin was corrected, so your earlier check-in now counts.', jsonb_build_object('event_id', p_event));
        v_n := v_n + 1;
      end if;
    end if;
  end loop;
  return v_n;
end $$;
revoke execute on function public.retest_failed_checkins(uuid) from public, anon, authenticated;

create function public.retest_after_pin_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.retest_failed_checkins(new.id);
  return null;
end $$;
revoke execute on function public.retest_after_pin_change() from public, anon, authenticated;
create trigger events_retest_checkins after update of start_lat, start_lng, finish_lat, finish_lng, checkin_radius_m on public.events
  for each row when (old.start_lat is distinct from new.start_lat or old.start_lng is distinct from new.start_lng
                     or old.finish_lat is distinct from new.finish_lat or old.finish_lng is distinct from new.finish_lng
                     or old.checkin_radius_m is distinct from new.checkin_radius_m)
  execute function public.retest_after_pin_change();

-- ---------------------------------------------------------------------------
-- Pin confirmations, finish pin, radius override, saved venues
-- ---------------------------------------------------------------------------
-- 'start_line': "The pin is on the start line" (whoever edits the race). 'checked': "Pin checked" (MFA admin).
create function public.confirm_event_pin(p_event uuid, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_e public.events;
begin
  select * into v_e from public.events where id = p_event;
  if not found then
    raise exception 'Race not found' using errcode = 'P0002';
  end if;
  if p_kind = 'start_line' then
    if not (public.is_admin() or public.can_edit_event(p_event)) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    update public.events set pin_start_line_at = now(), pin_start_line_by = auth.uid() where id = p_event;
  elsif p_kind = 'checked' then
    if not public.is_admin() then
      raise exception 'Admins only' using errcode = '42501';
    end if;
    update public.events set pin_checked_at = now(), pin_checked_by = auth.uid() where id = p_event;
    -- Reuse confirmed pins: save the venue.
    insert into public.venues (name, region_id, lat, lng, confirmed_by, from_event_id)
    values (v_e.venue_name, v_e.region_id, v_e.start_lat, v_e.start_lng, auth.uid(), p_event)
    on conflict (lower(btrim(name)), coalesce(region_id, '00000000-0000-0000-0000-000000000000'))
    do update set lat = excluded.lat, lng = excluded.lng, confirmed_by = excluded.confirmed_by, confirmed_at = now(), from_event_id = excluded.from_event_id;
  else
    raise exception 'Unknown confirmation' using errcode = '22023';
  end if;
end $$;
revoke execute on function public.confirm_event_pin(uuid, text) from public, anon;
grant execute on function public.confirm_event_pin(uuid, text) to authenticated;

-- Admin: finish pin (optional) and per-event radius (null = the setting).
create function public.admin_set_checkin_area(p_event uuid, p_finish_lat double precision, p_finish_lng double precision, p_radius_m integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_before int;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if (p_finish_lat is null) <> (p_finish_lng is null) then
    raise exception 'Give both finish coordinates, or neither' using errcode = '22023';
  end if;
  if p_radius_m is not null and p_radius_m not between 50 and 5000 then
    raise exception 'Radius: 50 to 5000 metres' using errcode = '22023';
  end if;
  select count(*) into v_before from public.check_ins where event_id = p_event;
  perform set_config('runlime.audit_reason', 'Check-in area changed by an admin', true);
  update public.events set finish_lat = p_finish_lat, finish_lng = p_finish_lng, checkin_radius_m = p_radius_m where id = p_event;
  if not found then
    raise exception 'Race not found' using errcode = 'P0002';
  end if;
  return (select count(*)::int from public.check_ins where event_id = p_event) - v_before;
end $$;
revoke execute on function public.admin_set_checkin_area(uuid, double precision, double precision, integer) from public, anon;
grant execute on function public.admin_set_checkin_area(uuid, double precision, double precision, integer) to authenticated;

create function public.search_venues(p_query text) returns table (id uuid, name text, region_id uuid, lat double precision, lng double precision, confirmed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or exists (select 1 from public.organisation_members m where m.user_id = auth.uid())) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query select v.id, v.name, v.region_id, v.lat, v.lng, v.confirmed_at from public.venues v
    where char_length(btrim(coalesce(p_query, ''))) >= 2 and v.name ilike '%' || btrim(p_query) || '%'
    order by v.name limit 10;
end $$;
revoke execute on function public.search_venues(text) from public, anon;
grant execute on function public.search_venues(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Submit and publish now need the pin confirmations
-- ---------------------------------------------------------------------------
drop function public.submit_event(uuid);
create function public.submit_event(p_id uuid, p_pin_on_start_line boolean default false) returns public.event_status
language plpgsql security definer set search_path = '' as $$
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
  if not coalesce(p_pin_on_start_line, false) and v_e.pin_start_line_at is null then
    raise exception 'Confirm that the pin is on the start line before submitting' using errcode = '22023';
  end if;
  if v_e.pin_start_line_at is null then
    update public.events set pin_start_line_at = now(), pin_start_line_by = auth.uid() where id = p_id;
  end if;
  v_next := case when v_auto and v_e.listing_source = 'organiser' then 'published' else 'pending_approval' end;
  update public.events
     set status = v_next, submitted_at = now(), status_reason = null,
         published_at = case when v_next = 'published' then now() else published_at end
   where id = p_id;
  return v_next;
end $$;
revoke execute on function public.submit_event(uuid, boolean) from public, anon;
grant execute on function public.submit_event(uuid, boolean) to authenticated;

drop function public.review_event(uuid, public.event_status, text);
create function public.review_event(p_id uuid, p_decision public.event_status, p_reason text default null,
                                    p_pin_checked boolean default false, p_pin_on_start_line boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare v_e public.events;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_decision not in ('published', 'rejected', 'unpublished') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  select * into v_e from public.events where id = p_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if p_decision = 'published' and v_e.status not in ('draft', 'pending_approval', 'unpublished', 'rejected') then
    raise exception 'This race is already live (%). Use "Postpone or cancel" to change its status', v_e.status using errcode = '22023';
  end if;
  if p_decision = 'rejected' and v_e.status <> 'pending_approval' then
    raise exception 'Only races waiting for approval can be rejected' using errcode = '22023';
  end if;
  if p_decision = 'unpublished' and v_e.status not in ('published', 'postponed', 'cancelled') then
    raise exception 'Only live races can be unpublished' using errcode = '22023';
  end if;
  if p_decision in ('rejected', 'unpublished') and char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if p_decision = 'published' then
    if v_e.pin_start_line_at is null and not coalesce(p_pin_on_start_line, false) then
      raise exception 'Confirm that the pin is on the start line before publishing' using errcode = '22023';
    end if;
    if v_e.pin_checked_at is null and not coalesce(p_pin_checked, false) then
      raise exception 'Tick "Pin checked" before publishing' using errcode = '22023';
    end if;
    if v_e.pin_start_line_at is null then
      perform public.confirm_event_pin(p_id, 'start_line');
    end if;
    if v_e.pin_checked_at is null then
      perform public.confirm_event_pin(p_id, 'checked');
    end if;
  end if;
  update public.events
     set status = p_decision,
         status_reason = case when p_decision = 'published' then null else btrim(p_reason) end,
         published_at = case when p_decision = 'published' then coalesce(published_at, now()) else published_at end,
         approved_by = case when p_decision = 'published' then auth.uid() else approved_by end
   where id = p_id;
end $$;
revoke execute on function public.review_event(uuid, public.event_status, text, boolean, boolean) from public, anon;
grant execute on function public.review_event(uuid, public.event_status, text, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Clean-up: failed attempts after 30 days (setting)
-- ---------------------------------------------------------------------------
create function public.purge_old_checkin_attempts() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  delete from public.checkin_attempts where created_at < now() - make_interval(days => public.setting_int('checkin.failed_retention_days', 30));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.purge_old_checkin_attempts() from public, anon, authenticated;
select cron.schedule('purge-checkin-attempts', '41 4 * * *', 'select public.purge_old_checkin_attempts()');

-- Data export: check-ins, failed attempts and help requests.
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
    'clubs', (select coalesce(jsonb_agg(jsonb_build_object('club', cl.name, 'status', m.status, 'role', m.role, 'primary', m.is_primary,
                                                           'requested_at', m.requested_at, 'approved_at', m.approved_at)), '[]'::jsonb)
                from public.club_members m join public.clubs cl on cl.id = m.club_id where m.user_id = v_uid),
    'club_requests', (select coalesce(jsonb_agg(jsonb_build_object('name', q.name, 'status', q.status, 'sent_at', q.created_at, 'note', q.review_note)), '[]'::jsonb)
                        from public.club_requests q where q.requester_id = v_uid),
    'organisations', (select coalesce(jsonb_agg(jsonb_build_object('name', o.name, 'role', m.role, 'status', o.status)), '[]'::jsonb)
                        from public.organisation_members m join public.organisations o on o.id = m.organisation_id where m.user_id = v_uid),
    'reports_sent', (select coalesce(jsonb_agg(jsonb_build_object('category', r.category, 'about', r.target_kind, 'details', r.details,
                                                                  'sent_at', r.created_at, 'status', r.status) order by r.created_at), '[]'::jsonb)
                       from public.reports r where r.reporter_id = v_uid),
    'rsvps', (select coalesce(jsonb_agg(jsonb_build_object('race', e.name, 'starts_at', e.starts_at, 'status', r.status, 'adults', r.adults,
                                                           'children', r.children, 'updated_at', r.updated_at) order by e.starts_at), '[]'::jsonb)
                from public.rsvps r join public.events e on e.id = r.event_id where r.user_id = v_uid),
    'following', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'status', f.status, 'since', f.created_at)), '[]'::jsonb)
                    from public.follows f join public.profiles p on p.id = f.followee_id where f.follower_id = v_uid),
    'followers', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'status', f.status, 'since', f.created_at)), '[]'::jsonb)
                    from public.follows f join public.profiles p on p.id = f.follower_id where f.followee_id = v_uid),
    'blocked', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'since', b.created_at)), '[]'::jsonb)
                  from public.blocks b join public.profiles p on p.id = b.blocked_id where b.blocker_id = v_uid),
    'notifications', (select coalesce(jsonb_agg(jsonb_build_object('type', n.kind, 'title', n.title, 'body', n.body, 'sent_at', n.created_at, 'read_at', n.read_at)
                                               order by n.created_at), '[]'::jsonb) from public.notifications n where n.user_id = v_uid),
    'notification_settings', (select to_jsonb(s) - 'user_id' from public.notification_settings s where s.user_id = v_uid),
    'push_devices', (select coalesce(jsonb_agg(jsonb_build_object('platform', t.platform, 'registered_at', t.created_at, 'last_seen_at', t.last_seen_at)), '[]'::jsonb)
                       from public.push_tokens t where t.user_id = v_uid),
    'check_ins', (select coalesce(jsonb_agg(jsonb_build_object('race', e.name, 'starts_at', e.starts_at, 'checked_in_at', c.checked_in_at,
                                                               'how', c.status, 'location_3dp', case when c.lat is null then null else c.lat || ',' || c.lng end,
                                                               'accuracy_m', c.accuracy_m, 'distance_m', c.distance_m) order by c.checked_in_at), '[]'::jsonb)
                    from public.check_ins c join public.events e on e.id = c.event_id where c.user_id = v_uid),
    'checkin_attempts', (select coalesce(jsonb_agg(jsonb_build_object('race', e.name, 'at', a.created_at, 'result', a.reason,
                                                                      'location_3dp', a.lat || ',' || a.lng, 'accuracy_m', a.accuracy_m, 'distance_m', a.distance_m)
                                                   order by a.created_at), '[]'::jsonb)
                           from public.checkin_attempts a join public.events e on e.id = a.event_id where a.user_id = v_uid),
    'checkin_help_requests', (select coalesce(jsonb_agg(jsonb_build_object('race', e.name, 'note', h.note, 'status', h.status, 'sent_at', h.created_at,
                                                                           'decision', h.decision_reason) order by h.created_at), '[]'::jsonb)
                                from public.checkin_help_requests h join public.events e on e.id = h.event_id where h.user_id = v_uid)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Venue search (Nominatim, OSMF usage policy): results cached, one request per second for the whole app.
-- ---------------------------------------------------------------------------
-- What the venue search found for a race (for the "pin is far from the address" warning and the precision label).
create function public.set_event_geocode(p_event uuid, p_precision text, p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_admin() or public.can_edit_event(p_event)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_precision is not null and p_precision not in ('exact', 'street', 'town') then
    raise exception 'Unknown precision' using errcode = '22023';
  end if;
  update public.events set geocode_precision = p_precision, geocoded_lat = p_lat, geocoded_lng = p_lng where id = p_event;
end $$;
revoke execute on function public.set_event_geocode(uuid, text, double precision, double precision) from public, anon;
grant execute on function public.set_event_geocode(uuid, text, double precision, double precision) to authenticated;

create table public.geocode_cache (
  query text primary key,
  results jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.geocode_cache enable row level security;
create table public.geocode_rate (
  id boolean primary key default true check (id),
  last_request_at timestamptz not null default 'epoch'
);
insert into public.geocode_rate default values;
alter table public.geocode_rate enable row level security;
-- No direct access to either table; only the functions below.

create function public.can_use_venue_search() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (select 1 from public.organisation_members m where m.user_id = auth.uid())
$$;
revoke execute on function public.can_use_venue_search() from public, anon, authenticated;

-- Cached results (30 days) for a normalised query, or null.
create function public.geocode_cached(p_query text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_use_venue_search() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return (select results from public.geocode_cache where query = lower(btrim(p_query)) and created_at > now() - interval '30 days');
end $$;
revoke execute on function public.geocode_cached(text) from public, anon;
grant execute on function public.geocode_cached(text) to authenticated;

-- Takes the single app-wide slot if the last request was at least a second ago (Nominatim: max 1 request/second).
create function public.geocode_take_slot() returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_ok boolean;
begin
  if not public.can_use_venue_search() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.geocode_rate set last_request_at = clock_timestamp()
   where id and last_request_at <= clock_timestamp() - interval '1 second'
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;
revoke execute on function public.geocode_take_slot() from public, anon;
grant execute on function public.geocode_take_slot() to authenticated;

create function public.geocode_store(p_query text, p_results jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_use_venue_search() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 10 then
    raise exception 'Bad results' using errcode = '22023';
  end if;
  insert into public.geocode_cache (query, results) values (lower(btrim(p_query)), p_results)
  on conflict (query) do update set results = excluded.results, created_at = now();
end $$;
revoke execute on function public.geocode_store(text, jsonb) from public, anon;
grant execute on function public.geocode_store(text, jsonb) to authenticated;
