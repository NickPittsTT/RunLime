begin;
\ir _helpers.psql
select plan(22);

select tests.create_user('admin3@runlime.test') as admin \gset
select tests.create_user('runner3@runlime.test') as runner \gset
insert into public.user_roles values (:'admin', 'platform_admin');

\set ev '{"name":"Postpone Date 5K","starts_at":"2031-10-30T06:00:00-04:00","venue_name":"Queen''s Park Savannah","start_lat":10.67,"start_lng":-61.51,"registration_url":"https://example.org/register"}'
\set dist '[{"km":5,"label":"5K"}]'

select tests.authenticate_as(:'admin', 'aal2');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('listing_source', 'runlime', 'region_id', tests.area_id('Central')), :'dist') as listing \gset
select public.review_event(:'listing', 'published');

select has_column('public', 'events', 'original_starts_at', 'events keep the original start of a postponed race');

-- Postpone to a known new date: the new date is stored, the original is kept.
select throws_ok(format($$select public.change_event_status(%L, 'postponed', 'Heavy rain expected', now() - interval '1 day')$$, :'listing'),
  '22023', null, 'the new date must be in the future');
select throws_ok(format($$select public.change_event_status(%L, 'postponed', 'Heavy rain expected', '2031-10-30T06:00:00-04:00')$$, :'listing'),
  '22023', null, 'the new date cannot be the original date');
select lives_ok(format($$select public.change_event_status(%L, 'postponed', 'Heavy rain expected', '2031-11-17T06:30:00-04:00')$$, :'listing'),
  'admin postpones to 17 Nov, 6:30 am');
select is((select starts_at from public.events where id = :'listing'), '2031-11-17T06:30:00-04:00'::timestamptz, 'the race now starts on the new date');
select is((select original_starts_at from public.events where id = :'listing'), '2031-10-30T06:00:00-04:00'::timestamptz, 'the original date is kept');

-- The app reads the calendar as anon / a runner: it sees the new date and the original.
select tests.authenticate_anon();
select is((select status::text || ' ' || starts_at::text || ' ' || original_starts_at::text from public.events where id = :'listing'),
  'postponed ' || '2031-11-17T06:30:00-04:00'::timestamptz::text || ' ' || '2031-10-30T06:00:00-04:00'::timestamptz::text,
  'the public (app and website) see postponed, the new date and the original date');
select tests.authenticate_as(:'runner');
select is((select count(*)::int from public.events where id = :'listing'
            and starts_at >= '2031-11-01T00:00:00-04:00' and starts_at < '2031-12-01T00:00:00-04:00'), 1,
  'the race is in the November calendar window');

-- Change the new date again: the original stays the first date.
select tests.authenticate_as(:'admin', 'aal2');
select throws_ok(format($$select public.change_event_status(%L, 'postponed', 'Still raining', null)$$, :'listing'),
  '22023', null, 'an already-postponed race needs a new date to be postponed again');
select lives_ok(format($$select public.change_event_status(%L, 'postponed', 'Venue clash on 17 Nov', '2031-11-24T06:30:00-04:00')$$, :'listing'),
  'admin moves the new date to 24 Nov');
select is((select starts_at from public.events where id = :'listing'), '2031-11-24T06:30:00-04:00'::timestamptz, 'new date updated');
select is((select original_starts_at from public.events where id = :'listing'), '2031-10-30T06:00:00-04:00'::timestamptz, 'original date unchanged');
select is((select status_reason from public.events where id = :'listing'), 'Venue clash on 17 Nov', 'reason updated');

-- Cancel keeps both dates; a date is refused when not postponing.
select throws_ok(format($$select public.change_event_status(%L, 'cancelled', 'Venue unavailable', '2031-12-01T06:00:00-04:00')$$, :'listing'),
  '22023', null, 'a new date only applies when postponing');
select lives_ok(format($$select public.change_event_status(%L, 'cancelled', 'Venue unavailable', null)$$, :'listing'), 'postponed race cancelled');
select is((select original_starts_at from public.events where id = :'listing'), '2031-10-30T06:00:00-04:00'::timestamptz, 'cancelling keeps the original date');

-- Back on: undoes the postponement and restores the original date.
select lives_ok(format($$select public.change_event_status(%L, 'published', '', null)$$, :'listing'), 'back on');
select is((select starts_at from public.events where id = :'listing'), '2031-10-30T06:00:00-04:00'::timestamptz, 'back on restores the original date');
select is((select original_starts_at from public.events where id = :'listing'), null, 'and clears the moved-from date');

-- Postponed with no new date yet: date stays, nothing marked as moved.
select lives_ok(format($$select public.change_event_status(%L, 'postponed', 'New date to follow', null)$$, :'listing'), 'postponed, date not known yet');
select is((select original_starts_at from public.events where id = :'listing'), null, 'no new date: the original is not marked as moved');

-- History: each date move is recorded.
select is(
  (select array_agg(new_value::timestamptz order by changed_at, id) from public.event_changes where event_id = :'listing' and field = 'starts_at'),
  array['2031-11-17T06:30:00-04:00', '2031-11-24T06:30:00-04:00', '2031-10-30T06:00:00-04:00']::timestamptz[],
  'change history records each date move');

select * from finish();
rollback;
