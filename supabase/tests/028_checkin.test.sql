-- Phase 4: GPS check-in (owner decisions 31 Oct 2026) and the pin safeguards (PROGRESS "Phase 4 notes").
begin;
\ir _helpers.psql
select plan(50);

select tests.create_user('admin28@runlime.test') as admin \gset
select tests.create_user('ana28@runlime.test') as ana \gset
select tests.create_user('ben28@runlime.test') as ben \gset
select tests.create_user('cat28@runlime.test') as cat \gset
select tests.create_user('dan28@runlime.test') as dan \gset
insert into public.user_roles values (:'admin', 'platform_admin');

-- ---------- Settings ----------
select is(public.setting_int('checkin.radius_m', 0), 500, 'radius 500 m (owner)');
select is(public.setting_int('checkin.window_before_min', 0), 60, 'opens 1 hour before the start');
select is(public.setting_int('checkin.window_after_min', 0), 180, 'closes 3 hours after the start');
select is(public.setting_int('checkin.failed_retention_days', 0), 30, 'failed attempts kept 30 days');

-- ---------- Pin confirmations before publishing ----------
\set ev '{"name":"Check-in 5K","starts_at":"2031-05-01T06:00:00-04:00","venue_name":"Queen''s Park Savannah","start_lat":10.6700,"start_lng":-61.5100,"registration_url":"https://example.org/r"}'
select tests.authenticate_as(:'admin', 'aal2');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('listing_source', 'runlime', 'region_id', tests.area_id('Central')), '[{"km":5,"label":"5K"}]') as race \gset
select throws_ok(format($$select public.review_event(%L, 'published')$$, :'race'), '22023', 'Confirm that the pin is on the start line before publishing', 'publishing needs "the pin is on the start line"');
select throws_ok(format($$select public.review_event(%L, 'published', null, false, true)$$, :'race'), '22023', 'Tick "Pin checked" before publishing', 'and the admin''s "Pin checked"');
select lives_ok(format($$select public.review_event(%L, 'published', null, true, true)$$, :'race'), 'with both ticks it publishes');
select isnt((select pin_checked_at from public.events where id = :'race'), null, 'pin checked is recorded');
select is((select count(*)::int from public.search_venues('Savannah')), 1, 'a checked pin is saved as a reusable venue');
select tests.clear_authentication();
update public.events set start_lat = 10.6701 where id = :'race';
select is((select pin_checked_at from public.events where id = :'race'), null, 'moving the pin clears "Pin checked"');
select is((select pin_start_line_at from public.events where id = :'race'), null, 'and "on the start line"');
update public.events set start_lat = 10.6700, starts_at = now() + interval '30 minutes' where id = :'race';

-- ---------- Check-in: inside the window and radius ----------
select tests.authenticate_as(:'ana');
select is(public.check_in(:'race', 10.6720, -61.5100, 10) ->> 'result', 'ok', 'about 220 m from the start pin, 30 min before the start: checked in');
select is(public.check_in(:'race', 10.6720, -61.5100, 10) ->> 'result', 'already', 'only once per race');
select is((select lat::text || ',' || lng::text from public.check_ins where user_id = :'ana'), '10.672,-61.510', 'location stored rounded to 3 decimal places');
select is((public.my_checkin_status(:'race') ->> 'checked_in')::boolean, true, 'the app sees it');
select is(jsonb_array_length(public.export_my_data() -> 'check_ins'), 1, 'check-ins are in the data export');

-- Too far; the accuracy allowance is capped at 100 m.
select tests.authenticate_as(:'ben');
select is(public.check_in(:'race', 10.6750, -61.5100, 80) ->> 'result', 'ok', '556 m away with 80 m accuracy counts (556 − 80 ≤ 500)');
select tests.authenticate_as(:'cat');
select is(public.check_in(:'race', 10.6770, -61.5100, 400) ->> 'result', 'too_far', '778 m away with 400 m accuracy does not (allowance capped at 100 m)');
select tests.clear_authentication();
select is((select reason || ' ' || lat::text || ' ' || accuracy_m::text from public.checkin_attempts where user_id = :'cat'), 'too_far 10.677 400', 'failed attempt kept: rounded location, accuracy, reason');

-- ---------- The window ----------
update public.events set starts_at = now() + interval '2 hours' where id = :'race';
select tests.authenticate_as(:'dan');
select is(public.check_in(:'race', 10.6700, -61.5100, 5) ->> 'result', 'too_early', '2 hours before the start: too early');
select tests.clear_authentication();
update public.events set starts_at = now() - interval '4 hours' where id = :'race';
select tests.authenticate_as(:'dan');
select is(public.check_in(:'race', 10.6700, -61.5100, 5) ->> 'result', 'too_late', '4 hours after the start: too late');
-- Postponed to a new date: the window follows the new date.
select tests.clear_authentication();
update public.events set status = 'postponed', original_starts_at = starts_at, starts_at = now() + interval '10 minutes' where id = :'race';
select tests.authenticate_as(:'dan');
select is(public.check_in(:'race', 10.6700, -61.5100, 5) ->> 'result', 'ok', 'postponed to a new date: check-in follows the new date');
-- Postponed with no new date, and cancelled: closed.
select tests.clear_authentication();
select tests.create_user('eve28@runlime.test') as eve \gset
update public.events set original_starts_at = null where id = :'race';
select tests.authenticate_as(:'eve');
select is(public.check_in(:'race', 10.6700, -61.5100, 5) ->> 'result', 'not_live', 'postponed without a new date: closed');
select tests.clear_authentication();
update public.events set status = 'cancelled' where id = :'race';
select tests.authenticate_as(:'eve');
select is(public.check_in(:'race', 10.6700, -61.5100, 5) ->> 'result', 'not_live', 'cancelled: closed');
select tests.clear_authentication();
update public.events set status = 'published', starts_at = now() where id = :'race';

-- ---------- Optional finish pin ----------
select tests.authenticate_as(:'admin', 'aal2');
select public.admin_set_checkin_area(:'race', 10.7000, -61.5100, null);
select tests.authenticate_as(:'eve');
select is(public.check_in(:'race', 10.7010, -61.5100, 5) ->> 'result', 'ok', 'near the finish pin also counts');

-- ---------- "I'm here but can't check in" and manual approval ----------
select tests.clear_authentication();
select tests.create_user('fay28@runlime.test') as fay \gset
select tests.authenticate_as(:'fay');
select throws_ok(format($$select public.request_checkin_help(%L, 'At the tent')$$, :'race'), '22023', null, 'help needs a check-in attempt first');
select is(public.check_in(:'race', 10.6850, -61.5100, 20) ->> 'result', 'too_far', '1.7 km away: too far');
select isnt(public.request_checkin_help(:'race', 'I am at the registration tent'), null, 'help request sent');
select throws_ok($$select * from public.admin_checkin_queue()$$, '42501', null, 'only admins see the queue');
select tests.authenticate_as(:'admin', 'aal2');
select is((select count(*)::int from public.admin_checkin_queue() where kind = 'help' and user_id = :'fay'), 1, 'admin sees the help request');
select throws_ok(format($$select public.admin_approve_checkin(%L, %L, '')$$, :'fay', :'race'), '22023', null, 'manual approval needs a reason');
select isnt(public.admin_approve_checkin(:'fay', :'race', 'Confirmed with the race director by phone'), null, 'admin approves with a reason');
select tests.clear_authentication();
select is((select status from public.check_ins where user_id = :'fay'), 'manual', 'recorded as a manual check-in');
select is((select status from public.checkin_help_requests where user_id = :'fay'), 'approved', 'the request is closed');
select is((select count(*)::int from public.notifications where user_id = :'fay' and kind = 'checkin_update'), 1, 'the runner is told');
select ok(exists (select 1 from audit.log where table_name = 'check_ins' and reason = 'Confirmed with the race director by phone'), 'audit-logged with the reason');

-- ---------- A pin or radius correction re-tests failed attempts ----------
select tests.clear_authentication();
select tests.create_user('gus28@runlime.test') as gus \gset
select tests.authenticate_as(:'gus');
select is(public.check_in(:'race', 10.6790, -61.5100, 10) ->> 'result', 'too_far', '1 km from the start (and the finish): too far');
select tests.authenticate_as(:'admin', 'aal2');
select is(public.admin_set_checkin_area(:'race', 10.7000, -61.5100, 1200), 2, 'radius corrected to 1.2 km: the 2 earlier "too far" attempts inside 1.2 km are re-tested and approved');
select tests.clear_authentication();
select is((select status from public.check_ins where user_id = :'gus'), 'approved_after_correction', 'marked "approved after correction"');
select ok(exists (select 1 from audit.log where table_name = 'check_ins' and reason like 'Pin or radius corrected%'), 'audit-logged');

-- ---------- Privacy, access and clean-up ----------
select tests.authenticate_as(:'ben');
select is((select count(*)::int from public.check_ins), 1, 'people see only their own check-ins');
select throws_ok(format($$select public.event_checkin_count(%L)$$, :'race'), '42501', null, 'runners can''t see check-in counts');
select tests.authenticate_as(:'admin', 'aal2');
select ok(public.event_checkin_count(:'race') >= 5, 'admins (and the race''s organisers) see the count, no names');
select tests.authenticate_anon();
select throws_ok(format($$select public.check_in(%L, 10.67, -61.51, 5)$$, :'race'), '42501', null, 'signed-out visitors can''t check in');
select tests.clear_authentication();
insert into public.checkin_attempts (user_id, event_id, lat, lng, accuracy_m, distance_m, reason, created_at) values (:'cat', :'race', 10.677, -61.51, 20, 900, 'too_far', now() - interval '31 days');
select ok(public.purge_old_checkin_attempts() >= 1, 'failed attempts older than 30 days are deleted');
update public.app_settings set value = '1' where key = 'checkin.max_attempts_per_day';
select tests.create_user('hal28@runlime.test') as hal \gset
select tests.authenticate_as(:'hal');
select public.check_in(:'race', 10.75, -61.51, 5);
select throws_ok(format($$select public.check_in(%L, 10.69, -61.51, 5)$$, :'race'), 'P0429', null, 'attempts are limited per day');

-- ---------- Venue search: organisers/admins only, one request per second app-wide, cached ----------
select tests.clear_authentication();
update public.geocode_rate set last_request_at = 'epoch';
select tests.authenticate_as(:'ben');
select throws_ok($$select public.geocode_take_slot()$$, '42501', null, 'runners can''t use the venue search');
select tests.authenticate_as(:'admin', 'aal2');
select is(public.geocode_take_slot(), true, 'the first request takes the slot');
select is(public.geocode_take_slot(), false, 'a second request within the same second is refused (1 request/second for the whole app)');
select public.geocode_store('  Queen''s Park Savannah ', '[{"lat":10.67,"lng":-61.51,"precision":"exact"}]');
select is(public.geocode_cached('queen''s park savannah') -> 0 ->> 'precision', 'exact', 'results are cached by normalised query');

select * from finish();
rollback;
