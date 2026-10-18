begin;
\ir _helpers.psql
select plan(26);

select tests.create_user('admin17@runlime.test') as admin \gset
select tests.create_user('ana17@runlime.test') as ana \gset
select tests.create_user('ben17@runlime.test') as ben \gset
insert into public.user_roles values (:'admin', 'platform_admin');

\set ev '{"name":"RSVP Test 5K","starts_at":"2031-05-01T06:00:00-04:00","venue_name":"Queen''s Park Savannah","start_lat":10.67,"start_lng":-61.51,"registration_url":"https://example.org/register"}'
\set dist '[{"km":5,"label":"5K"}]'
select tests.authenticate_as(:'admin', 'aal2');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('listing_source', 'runlime', 'region_id', tests.area_id('Central')), :'dist') as race \gset
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('name', 'Draft Race 5K', 'listing_source', 'runlime', 'region_id', tests.area_id('Central')), :'dist') as draft \gset
select public.review_event(:'race', 'published');

-- ---------- Setting an RSVP ----------
select tests.authenticate_as(:'ana');
select lives_ok(format($$select public.set_rsvp(%L, 'going', 2, 3)$$, :'race'), 'Ana is going with 2 adults (incl. her) and 3 children');
select is((select status::text || ' ' || adults || ' ' || children from public.rsvps where event_id = :'race'), 'going 2 3', 'stored on her RSVP');
select throws_ok(format($$select public.set_rsvp(%L, 'going', 0, 1)$$, :'race'), '22023', null, 'at least one adult (the person) in the group');
select throws_ok(format($$select public.set_rsvp(%L, 'going', 11, 0)$$, :'race'), '22023', null, 'adults limited by setting rsvp.max_adults');
select throws_ok(format($$select public.set_rsvp(%L, 'going', 1, 11)$$, :'race'), '22023', null, 'children limited by setting rsvp.max_children');
select throws_ok(format($$select public.set_rsvp(%L, 'going')$$, :'draft'), 'P0002', null, 'no RSVP to a race that is not public');
select throws_ok(format($$insert into public.rsvps (user_id, event_id, status) values (%L, %L, 'going')$$, :'ana', :'race'),
  '42501', null, 'RSVPs only through set_rsvp');
select lives_ok(format($$select public.set_rsvp(%L, 'maybe', 1, 0)$$, :'race'), 'she changes to Maybe');
select lives_ok(format($$select public.set_rsvp(%L, 'going', 2, 3)$$, :'race'), 'and back to Going');

select tests.authenticate_as(:'ben');
select lives_ok(format($$select public.set_rsvp(%L, 'going', 1, 0)$$, :'race'), 'Ben is going alone');
select is((select count(*)::int from public.rsvps), 1, 'Ben sees only his own RSVP');

-- ---------- Public count: adults only, never children ----------
select tests.authenticate_anon();
select is((select going || '/' || maybe from public.rsvp_counts(array[:'race'::uuid])), '3/0', 'the public sees 3 going (adults), not children');
select throws_ok($$select * from public.rsvps$$, '42501', null, 'anonymous users cannot read RSVPs');
select is((select count(*)::int from public.rsvp_counts(array[:'draft'::uuid])), 0, 'no counts for non-public races');

-- ---------- Organiser/admin totals: children as a total only ----------
select tests.authenticate_as(:'ben');
select throws_ok(format($$select public.rsvp_summary(%L)$$, :'race'), '42501', null, 'runners cannot see the summary');
select tests.authenticate_as(:'admin', 'aal2');
select is((public.rsvp_summary(:'race') ->> 'going_children')::int, 3, 'admins see the children total');
select is((public.rsvp_summary(:'race') ->> 'going_adults')::int, 3, 'and the adults total');
select is((public.rsvp_summary(:'race') ->> 'going_people')::int, 2, 'and how many RSVPs');
select is(jsonb_typeof(public.rsvp_summary(:'race') -> 'trend'), 'array', 'with a daily trend');
select is(((public.rsvp_summary(:'race') -> 'trend') -> -1 ->> 'going_adults')::int, 3, 'the trend ends at the current total');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'rsvp_changes' and column_name like '%user%'), 0,
  'the trend table holds no person');

-- ---------- Not going, cancelled races, deletion ----------
select tests.authenticate_as(:'ana');
select lives_ok(format($$select public.set_rsvp(%L, 'not_going', 5, 5)$$, :'race'), 'Ana says Not going');
select is((select adults || ' ' || children from public.rsvps where event_id = :'race'), '1 0', 'Not going drops the group counts');
select tests.authenticate_as(:'admin', 'aal2');
select public.change_event_status(:'race', 'cancelled', 'Venue unavailable', null);
select tests.authenticate_as(:'ben');
select throws_ok(format($$select public.set_rsvp(%L, 'going', 1, 0)$$, :'race'), '22023', null, 'no Going on a cancelled race');
select lives_ok(format($$delete from public.rsvps where event_id = %L$$, :'race'), 'a runner can remove their RSVP');
select is(jsonb_array_length(public.export_my_data() -> 'rsvps'), 0, 'RSVPs are in the data export (none left for Ben)');

select * from finish();
rollback;
