-- Phase 5: runs (owner decisions 31 Oct 2026): owner-only, idempotent upload, validation, race link, totals,
-- entitlement placeholder, data export, deletion with the account.
begin;
\ir _helpers.psql
select plan(21);

select tests.create_user('ana29@runlime.test') as ana \gset
select tests.create_user('ben29@runlime.test') as ben \gset
select tests.create_user('admin29@runlime.test') as admin \gset
insert into public.user_roles values (:'admin', 'platform_admin');
select gen_random_uuid() as run1 \gset
select gen_random_uuid() as run2 \gset

select is((select value #>> '{}' from public.app_settings where key = 'runs.privacy_zone_m'), '200', 'privacy zone 200 m (setting)');

-- ---------- Entitlement: free for everyone until Phase 7 ----------
select tests.authenticate_as(:'ana');
select is(public.my_entitlements() ->> 'tracker', 'true', 'the tracker is free until Phase 7 (feature.tracker)');

-- ---------- Upload (idempotent on the phone's id) ----------
\set r '{"started_at":"2026-10-30T10:00:00Z","ended_at":"2026-10-30T10:30:00Z","distance_m":5010,"moving_seconds":1500,"elapsed_seconds":1620,"avg_pace_sec_per_km":299,"splits":[300,301,298,299,300],"steps":5200,"calories_est":360,"calories_basis":"general","route_polyline":"_p~iF~ps|U_ulLnnqC","point_count":750}'
select is(public.upsert_run(:'r'::jsonb || jsonb_build_object('id', :'run1')), :'run1'::uuid, 'a run uploads');
select lives_ok(format($$select public.upsert_run(%L::jsonb || jsonb_build_object('id', %L, 'steps', 5210))$$, :'r', :'run1'), 'uploading the same run again (retry) updates it');
select is((select count(*)::int from public.runs where id = :'run1'), 1, 'still one run');
select is((select steps from public.runs where id = :'run1'), 5210, 'with the latest values');

-- ---------- Validation ----------
select throws_ok(format($$select public.upsert_run(%L::jsonb || jsonb_build_object('id', %L, 'ended_at', '2026-10-30T09:00:00Z'))$$, :'r', :'run2'), '22023', null, 'end before start is refused');
select throws_ok(format($$select public.upsert_run(%L::jsonb || jsonb_build_object('id', %L, 'distance_m', 400000))$$, :'r', :'run2'), '22023', null, 'impossible distance is refused');
select throws_ok(format($$select public.upsert_run(%L::jsonb || jsonb_build_object('id', %L, 'moving_seconds', 99999))$$, :'r', :'run2'), '22023', null, 'moving time longer than the run is refused');
select throws_ok(format($$select public.upsert_run(%L::jsonb || jsonb_build_object('id', %L, 'started_at', '2030-01-01T00:00:00Z', 'ended_at', '2030-01-01T01:00:00Z'))$$, :'r', :'run2'), '22023', null, 'runs in the future are refused');

-- ---------- Private: owner only ----------
select tests.authenticate_as(:'ben');
select is((select count(*)::int from public.runs), 0, 'another runner sees none of my runs');
select throws_ok(format($$select public.upsert_run(%L::jsonb || jsonb_build_object('id', %L))$$, :'r', :'run1'), 'P0002', null, 'and can''t overwrite one by its id');
select public.delete_run(:'run1');
select tests.authenticate_as(:'admin', 'aal2');
select is((select count(*)::int from public.runs), 0, 'admins have no access to private runs either');
select tests.clear_authentication();
select is((select count(*)::int from public.runs where id = :'run1'), 1, 'someone else''s delete does nothing');

-- ---------- Linked to a race the runner checked in to ----------
\set ev '{"name":"Runs 5K","starts_at":"2031-05-01T06:00:00-04:00","venue_name":"Savannah","start_lat":10.67,"start_lng":-61.51,"registration_url":"https://example.org/r"}'
select tests.authenticate_as(:'admin', 'aal2');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('listing_source', 'runlime', 'region_id', tests.area_id('Central')), '[{"km":5,"label":"5K"}]') as race \gset
select public.review_event(:'race', 'published', null, true, true);
select tests.clear_authentication();
update public.events set starts_at = now() - interval '20 minutes' where id = :'race';
select tests.authenticate_as(:'ana');
select public.check_in(:'race', 10.67, -61.51, 5);
select public.upsert_run(:'r'::jsonb || jsonb_build_object('id', :'run2', 'started_at', now() - interval '15 minutes', 'ended_at', now() - interval '1 minute', 'moving_seconds', 780, 'elapsed_seconds', 840));
select is((select event_id from public.runs where id = :'run2'), :'race'::uuid, 'a run started during the race''s check-in window is linked to it');

-- ---------- Totals ----------
select is((public.my_run_totals() ->> 'runs')::int, 2, 'totals: runs');
select is((public.my_run_totals() ->> 'distance_m')::int, 10020, 'totals: distance');
select is((public.my_run_totals() -> 'per_race' -> 0 ->> 'name'), 'Runs 5K', 'per-race totals');
select is(jsonb_array_length(public.export_my_data() -> 'runs'), 2, 'runs are in the data export');

-- ---------- Deleting ----------
select public.delete_run(:'run2');
select is((select count(*)::int from public.runs where user_id = :'ana'), 1, 'the owner can delete a run');
select tests.clear_authentication();
delete from auth.users where id = :'ana';
select is((select count(*)::int from public.runs where id = :'run1'), 0, 'runs are deleted with the account');

select * from finish();
rollback;
