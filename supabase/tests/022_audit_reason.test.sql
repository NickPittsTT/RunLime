begin;
\ir _helpers.psql
select plan(9);

select tests.create_user('admin22@runlime.test') as admin \gset
select tests.create_user('ann22@runlime.test') as ann \gset
insert into public.user_roles values (:'admin', 'platform_admin');
\set ev '{"name":"Reason Test 5K","starts_at":"2031-09-01T06:00:00-04:00","venue_name":"Savannah","start_lat":10.67,"start_lng":-61.51,"registration_url":"https://example.org/r"}'
select tests.authenticate_as(:'admin', 'aal2');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('listing_source', 'runlime', 'region_id', tests.area_id('Central')), '[{"km":5,"label":"5K"}]') as race \gset
select public.review_event(:'race', 'published');
select tests.authenticate_as(:'ann');
select public.set_rsvp(:'race', 'going', 1, 0);

-- Only the service role can use the maintenance function.
select throws_ok(format($$select public.ops_correct_event_start(%L, '2031-10-31T06:00:00-04:00', 'Restore real date')$$, :'race'), '42501', null, 'signed-in users cannot call it');
select tests.authenticate_as(:'admin', 'aal2');
select throws_ok(format($$select public.ops_correct_event_start(%L, '2031-10-31T06:00:00-04:00', 'Restore real date')$$, :'race'), '42501', null, 'admins cannot call it either (they use the event form)');

select tests.clear_authentication();
set local role service_role;
select throws_ok(format($$select public.ops_correct_event_start(%L, '2031-10-31T06:00:00-04:00', 'short')$$, :'race'), '22023', null, 'a reason is required');
select throws_ok(format($$select public.ops_correct_event_start(%L, '2020-10-31T06:00:00-04:00', 'Restore real date')$$, :'race'), '22023', null, 'the date must be in the future');
select lives_ok(format($$select public.ops_correct_event_start(%L, '2031-10-31T06:00:00-04:00', 'Restore real date after Phase 2 testing')$$, :'race'), 'service role corrects the date');
reset role;

select is((select starts_at from public.events where id = :'race'), '2031-10-31T10:00:00Z'::timestamptz, 'new date stored (6:00 AM Port of Spain)');
select is((select reason from audit.log where table_name = 'events' and row_id = :'race' and 'starts_at' = any (changed_fields) order by id desc limit 1),
  'Restore real date after Phase 2 testing', 'the audit entry carries the reason');
select is((select reason from audit.log where table_name = 'events' and row_id = :'race' and action = 'insert'), null, 'ordinary changes have no reason');
select is((select count(*)::int from public.notifications where user_id = :'ann' and data ->> 'event_id' = :'race'), 0, 'a date correction on a published race notifies nobody');

select * from finish();
rollback;
