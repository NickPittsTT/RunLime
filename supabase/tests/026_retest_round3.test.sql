-- Owner retest round 3 (2026-10-30): C2 photos on Private accounts, C1 organiser message limits, B3 nickname error.
begin;
\ir _helpers.psql
select plan(24);

select tests.create_user('admin26@runlime.test') as admin \gset
select tests.create_user('priv26@runlime.test') as priv \gset
select tests.create_user('pub26@runlime.test') as pub \gset
select tests.create_user('fan26@runlime.test') as fan \gset
select tests.create_user('stranger26@runlime.test') as stranger \gset
select tests.create_user('owner26@runlime.test') as owner \gset
insert into public.user_roles values (:'admin', 'platform_admin');
update public.profiles set avatar_path = id || '/0123456789abcdef0123456789abcdef.jpg' where id in (:'priv', :'pub');
update public.profiles set account_privacy = 'public', nickname = 'Speedy26' where id = :'pub';

-- ---------- C2: Private account photos only for the person, approved followers and admins ----------
select tests.authenticate_as(:'fan');
select public.follow_user(:'priv');
select is((select avatar_path from public.search_people('priv26') limit 1), null, 'a pending follower sees initials in search');
select is(public.profile_card(:'priv') ->> 'avatar_path', null, 'and on the profile');
select tests.authenticate_as(:'priv');
select is(public.my_connections() -> 'requests' -> 0 ->> 'avatar_path', null, 'the request list shows the requester''s initials too (Private requester)');
select public.respond_follow_request(:'fan', true);
select isnt(public.profile_card(:'priv') ->> 'avatar_path', null, 'the person sees their own photo');
select tests.authenticate_as(:'fan');
select isnt((select avatar_path from public.search_people('priv26') limit 1), null, 'an approved follower sees the photo');
select isnt(public.profile_card(:'priv') ->> 'avatar_path', null, 'on the profile too');
select tests.authenticate_as(:'stranger');
select is((select avatar_path from public.search_people('priv26') limit 1), null, 'a non-follower sees initials');
select isnt((select avatar_path from public.search_people('pub26') limit 1), null, 'a Public account''s photo shows to everyone');
select is(public.my_connections() -> 'followers', '[]'::jsonb, '(no connections leak)');
select public.submit_report('sexual_content', 'profile_photo', :'priv', null, 'Not a running photo') as rep \gset
select tests.authenticate_as(:'admin', 'aal2');
select isnt((select current_avatar_path from public.admin_reports() where id = :'rep'), null, 'admins see the photo in the Reports queue');
select isnt(public.profile_card(:'priv') ->> 'avatar_path', null, 'and on profiles (MFA admin)');
select tests.clear_authentication();
select is((select count(*)::int from information_schema.routine_privileges
            where routine_schema = 'public' and routine_name = 'visible_avatar' and grantee in ('anon', 'authenticated', 'PUBLIC')), 0,
  'apps cannot call visible_avatar directly');

-- ---------- C1: 3 updates per race per 7 days; 10 in race week; admins exempt and recorded ----------
select is(public.setting_int('messages.per_race_per_week', 0), 3, 'normal limit 3 (setting)');
select is(public.setting_int('messages.race_week_limit', 0), 10, 'race-week limit 10 (setting)');

select tests.authenticate_as(:'owner');
select public.apply_as_organiser('Round Three Runners', 'hello@r3.test', '868-555-0100', '', 'Community 5K series for the retest.', false) as org \gset
select tests.authenticate_as(:'admin', 'aal2');
select public.review_organisation(:'org', 'verified');
\set ev '{"name":"Limits 5K","starts_at":"2031-05-01T06:00:00-04:00","venue_name":"Savannah","start_lat":10.67,"start_lng":-61.51,"registration_url":"https://example.org/r"}'
select tests.authenticate_as(:'owner');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('organisation_id', :'org', 'region_id', tests.area_id('Central')), '[{"km":5,"label":"5K"}]') as race \gset
select public.submit_event(:'race', true);
select tests.authenticate_as(:'admin', 'aal2');
select public.review_event(:'race', 'published', null, true, true);

select tests.authenticate_as(:'owner');
select is(public.event_message_allowance(:'race') - 'admin_exempt',
  '{"used":0,"limit":3,"remaining":3,"race_week":false,"normal_limit":3,"race_week_limit":10}'::jsonb, 'organiser starts with 3 of 3 left');
select public.send_event_message(:'race', 'Update one for runners.');
select public.send_event_message(:'race', 'Update two for runners.');
select public.send_event_message(:'race', 'Update three for runners.');
select throws_ok(format($$select public.send_event_message(%L, 'Update four for runners.')$$, :'race'), '22023',
  'You have used all 3 updates for this race in the last 7 days. In the 7 days before the race you can send up to 10',
  'the 4th update in a normal week is blocked, and the message explains the race-week allowance');

-- Status notices are automatic and never counted.
select tests.authenticate_as(:'admin', 'aal2');
select public.change_event_status(:'race', 'postponed', 'Heavy rain', null);
select public.change_event_status(:'race', 'published', '', null);
select is((select count(*)::int from public.event_messages where event_id = :'race'), 3, 'postponed / back on notices are not counted as updates');

-- Admins are exempt; their messages are recorded as admin messages, audit-logged and not counted.
select lives_ok(format($$select public.send_event_message(%L, 'Admin note: road closures.')$$, :'race'), 'admins are exempt from the limit');
select is((select count(*)::int from public.event_messages where event_id = :'race' and by_admin), 1, 'recorded as an admin message');
select tests.clear_authentication();
select ok(exists (select 1 from audit.log where table_name = 'event_messages' and action = 'insert' and after ->> 'by_admin' = 'true'), 'and audit-logged');
select tests.authenticate_as(:'owner');
select is((public.event_message_allowance(:'race') ->> 'used')::int, 3, 'the admin message does not use the organiser''s allowance');

-- Race week: the 7 days before the race (the postponed date when postponed) → 10.
select tests.clear_authentication();
update public.events set starts_at = now() + interval '5 days' where id = :'race';
select tests.authenticate_as(:'owner');
select is(public.event_message_allowance(:'race') ->> 'remaining', '7', 'in race week the organiser has 10, so 7 left');
select lives_ok(format($$select public.send_event_message(%L, 'Race week: bib pickup Friday.')$$, :'race'), 'and can send again');

-- ---------- B3: a nickname already in use gets a clear message ----------
select tests.clear_authentication();
select tests.create_user('late26@runlime.test', '1990-01-01', false) as late \gset
select tests.authenticate_as(:'late');
select throws_ok(format($$select public.complete_signup('1990-01-01', 'Late Joiner', 'SPEEDY26', %L, 't1', 'p1')$$, tests.area_id('Central')),
  '22023', 'That nickname is already taken. Choose another, or leave it empty.', 'a taken nickname (any case) says so plainly');

select * from finish();
rollback;
