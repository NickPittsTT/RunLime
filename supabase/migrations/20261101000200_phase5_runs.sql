-- Phase 5: run tracker, history and totals (owner decisions 31 Oct 2026).
-- Runs are recorded on the phone (expo-location foreground service), saved locally first, then uploaded through
-- upsert_run (idempotent on the phone's run id). Owner-only: no organiser, admin or public access. Kept while the
-- account exists; deleted with it; in the data export. Routes are never shown to anyone else (privacy zone setting
-- ready for any future sharing).

insert into public.app_settings (key, value, is_public, description) values
  ('runs.privacy_zone_m', '200', true, 'If a route is ever shown to others, this many metres at the start and end are hidden.'),
  ('runs.max_accuracy_m', '30', true, 'GPS fixes with a worse reported accuracy are dropped from runs.'),
  ('runs.max_distance_km', '300', false, 'Longest run the server accepts.'),
  ('feature.tracker_free', 'true', true, 'Phase 7 placeholder: the run tracker is free for everyone until plans are wired (entitlement feature.tracker).')
on conflict (key) do nothing;

create table public.runs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  distance_m integer not null check (distance_m >= 0),
  moving_seconds integer not null check (moving_seconds >= 0),
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  avg_pace_sec_per_km integer check (avg_pace_sec_per_km is null or avg_pace_sec_per_km > 0),
  splits jsonb not null default '[]' check (jsonb_typeof(splits) = 'array'),
  steps integer check (steps is null or steps >= 0),
  calories_est integer check (calories_est is null or calories_est >= 0),
  calories_basis text check (calories_basis is null or calories_basis in ('weight', 'general')),
  route_polyline text check (route_polyline is null or char_length(route_polyline) <= 400000),
  point_count integer not null default 0,
  source text not null default 'tracked' check (source in ('tracked')),
  event_id uuid references public.events (id) on delete set null,
  check_in_id uuid references public.check_ins (id) on delete set null,
  device_meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at >= started_at)
);
create index runs_user_started on public.runs (user_id, started_at desc);
alter table public.runs enable row level security;
create policy "own runs: read" on public.runs for select to authenticated using (user_id = (select auth.uid()));
grant select on public.runs to authenticated;

-- Phase 7 wires plans here; until then the tracker is free for everyone (owner).
create function public.has_feature(p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_feature
    when 'tracker' then coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'feature.tracker_free'), true)
    else false end
$$;
revoke execute on function public.has_feature(text) from public, anon;
grant execute on function public.has_feature(text) to authenticated;

create function public.my_entitlements() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('tracker', public.has_feature('tracker'))
$$;
revoke execute on function public.my_entitlements() from public, anon;
grant execute on function public.my_entitlements() to authenticated;

-- Save (or re-save) a run from the phone. Validates the numbers; links the run to a race the runner checked in to
-- when it started inside that race's check-in window (per-race totals; Phase 6 boards).
create function public.upsert_run(p_run jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := (p_run ->> 'id')::uuid;
  v_start timestamptz := (p_run ->> 'started_at')::timestamptz;
  v_end timestamptz := (p_run ->> 'ended_at')::timestamptz;
  v_dist int := (p_run ->> 'distance_m')::int;
  v_moving int := (p_run ->> 'moving_seconds')::int;
  v_elapsed int := (p_run ->> 'elapsed_seconds')::int;
  v_owner uuid;
  v_ci public.check_ins;
begin
  if v_uid is null or not public.has_profile() then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if not public.has_feature('tracker') then
    raise exception 'The run tracker is not included in your plan' using errcode = '42501';
  end if;
  if v_id is null or v_start is null or v_end is null or v_end < v_start or v_start > now() + interval '10 minutes' then
    raise exception 'Run times are not valid' using errcode = '22023';
  end if;
  if v_dist is null or v_dist < 0 or v_dist > public.setting_int('runs.max_distance_km', 300) * 1000 then
    raise exception 'Run distance is not valid' using errcode = '22023';
  end if;
  if v_moving is null or v_elapsed is null or v_moving < 0 or v_elapsed < 0 or v_moving > extract(epoch from v_end - v_start) + 60 then
    raise exception 'Run duration is not valid' using errcode = '22023';
  end if;
  select user_id into v_owner from public.runs where id = v_id;
  if v_owner is not null and v_owner <> v_uid then
    raise exception 'Run not found' using errcode = 'P0002';
  end if;
  select c.* into v_ci from public.check_ins c join public.events e on e.id = c.event_id
   where c.user_id = v_uid
     and v_start between e.starts_at - make_interval(mins => public.setting_int('checkin.window_before_min', 60))
                     and e.starts_at + make_interval(mins => public.setting_int('checkin.window_after_min', 180))
   order by abs(extract(epoch from v_start - e.starts_at)) limit 1;
  insert into public.runs (id, user_id, started_at, ended_at, distance_m, moving_seconds, elapsed_seconds, avg_pace_sec_per_km, splits,
                           steps, calories_est, calories_basis, route_polyline, point_count, event_id, check_in_id, device_meta)
  values (v_id, v_uid, v_start, v_end, v_dist, v_moving, v_elapsed, nullif((p_run ->> 'avg_pace_sec_per_km')::int, 0),
          coalesce(p_run -> 'splits', '[]'::jsonb), (p_run ->> 'steps')::int, (p_run ->> 'calories_est')::int, p_run ->> 'calories_basis',
          p_run ->> 'route_polyline', coalesce((p_run ->> 'point_count')::int, 0), v_ci.event_id, v_ci.id,
          coalesce(p_run -> 'device_meta', '{}'::jsonb) - 'location' - 'email')
  on conflict (id) do update set
    ended_at = excluded.ended_at, distance_m = excluded.distance_m, moving_seconds = excluded.moving_seconds,
    elapsed_seconds = excluded.elapsed_seconds, avg_pace_sec_per_km = excluded.avg_pace_sec_per_km, splits = excluded.splits,
    steps = excluded.steps, calories_est = excluded.calories_est, calories_basis = excluded.calories_basis,
    route_polyline = excluded.route_polyline, point_count = excluded.point_count, event_id = excluded.event_id,
    check_in_id = excluded.check_in_id, updated_at = now();
  return v_id;
end $$;
revoke execute on function public.upsert_run(jsonb) from public, anon;
grant execute on function public.upsert_run(jsonb) to authenticated;

create function public.delete_run(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.runs where id = p_id and user_id = auth.uid();
end $$;
revoke execute on function public.delete_run(uuid) from public, anon;
grant execute on function public.delete_run(uuid) to authenticated;

-- Totals (runs, km, time) and per-race totals for the signed-in runner.
create function public.my_run_totals() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'runs', (select count(*) from public.runs where user_id = v_uid),
    'distance_m', (select coalesce(sum(distance_m), 0) from public.runs where user_id = v_uid),
    'moving_seconds', (select coalesce(sum(moving_seconds), 0) from public.runs where user_id = v_uid),
    'races_attended', (select count(*) from public.check_ins where user_id = v_uid),
    'per_race', (select coalesce(jsonb_agg(jsonb_build_object('event_id', e.id, 'name', e.name, 'starts_at', e.starts_at, 'runs', x.runs,
                                                             'distance_m', x.distance_m, 'moving_seconds', x.moving_s) order by e.starts_at desc), '[]'::jsonb)
                   from (select event_id, count(*) runs, sum(distance_m) distance_m, sum(moving_seconds) moving_s
                           from public.runs where user_id = v_uid and event_id is not null group by event_id) x
                   join public.events e on e.id = x.event_id));
end $$;
revoke execute on function public.my_run_totals() from public, anon;
grant execute on function public.my_run_totals() to authenticated;

-- Data export now includes runs (with the route as an encoded polyline; GPX per run is in the app).
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
                                from public.checkin_help_requests h join public.events e on e.id = h.event_id where h.user_id = v_uid),
    'runs', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'started_at', r.started_at, 'ended_at', r.ended_at, 'distance_m', r.distance_m,
                                                          'moving_seconds', r.moving_seconds, 'elapsed_seconds', r.elapsed_seconds, 'avg_pace_sec_per_km', r.avg_pace_sec_per_km,
                                                          'splits_sec', r.splits, 'steps', r.steps, 'calories_est', r.calories_est, 'calories_basis', r.calories_basis,
                                                          'race', e.name, 'route_polyline', r.route_polyline) order by r.started_at), '[]'::jsonb)
               from public.runs r left join public.events e on e.id = r.event_id where r.user_id = v_uid)
  );
end;
$$;
