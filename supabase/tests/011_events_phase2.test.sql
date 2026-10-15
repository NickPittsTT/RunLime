begin;
\ir _helpers.psql
select plan(32);

select tests.create_user('owner@runlime.test') as owner \gset
select tests.create_user('runner@runlime.test') as runner \gset
select tests.create_user('admin@runlime.test') as admin \gset
select tests.create_user('helper@runlime.test') as helper \gset
insert into public.user_roles values (:'admin', 'platform_admin');

-- A verified organisation for the owner.
select tests.authenticate_as(:'owner');
select public.apply_as_organiser('Savannah Striders', 'hello@striders.tt', '868-555-0100', '', 'Community 5K series around the Queen''s Park Savannah.', false) as org \gset
select tests.authenticate_as(:'admin', 'aal2');
select public.review_organisation(:'org', 'verified');

\set ev '{"name":"Savannah Sunrise 5K","starts_at":"2031-03-01T06:00:00-04:00","venue_name":"Queen''s Park Savannah","start_lat":10.67,"start_lng":-61.51,"registration_url":"https://example.org/register"}'
\set dist '[{"km":5,"label":"5K"}]'

-- ---------- RunLime listings ----------
select tests.authenticate_as(:'owner');
select throws_ok(format($$select public.save_event(null, %L::jsonb || jsonb_build_object('listing_source','runlime','region_id',%L), %L)$$,
  :'ev', tests.area_id('Port of Spain & North-West'), :'dist'), '42501', null, 'organisers cannot create RunLime listings');

select tests.authenticate_as(:'admin', 'aal1');
select throws_ok(format($$select public.save_event(null, %L::jsonb || jsonb_build_object('listing_source','runlime','region_id',%L), %L)$$,
  :'ev', tests.area_id('Port of Spain & North-West'), :'dist'), '42501', null, 'admins need MFA to create listings');

select tests.authenticate_as(:'admin', 'aal2');
select throws_ok(format($$select public.save_event(null, (%L::jsonb - 'registration_url') || jsonb_build_object('listing_source','runlime','region_id',%L), %L)$$,
  :'ev', tests.area_id('Port of Spain & North-West'), :'dist'), '22023', null, 'a listing needs the official registration link');
select throws_ok(format($$select public.save_event(null, %L::jsonb || jsonb_build_object('listing_source','runlime','region_id',%L,'start_lat',51.5,'start_lng',-0.12), %L)$$,
  :'ev', tests.area_id('Port of Spain & North-West'), :'dist'), '22023', null, 'start pin must be inside Trinidad and Tobago');
select throws_ok(format($$select public.save_event(null, %L::jsonb || jsonb_build_object('listing_source','runlime','region_id',%L), '[]')$$,
  :'ev', tests.area_id('Port of Spain & North-West')), '22023', null, 'at least one distance is required');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('listing_source', 'runlime', 'region_id', tests.area_id('Port of Spain & North-West')), :'dist') as listing \gset
select is((select organisation_id from public.events where id = :'listing'), null, 'listing has no organiser');
select is((select listing_source::text from public.events where id = :'listing'), 'runlime', 'listing source recorded');
select is((select count(*)::int from public.event_distances where event_id = :'listing'), 1, 'distances saved');
select throws_ok(format($$insert into public.event_media (event_id, kind, storage_path, alt_text) values (%L, 'flyer', %L, 'Race flyer')$$,
  :'listing', :'listing' || '/flyer.png'), '23514', null, 'no flyers on RunLime listings');
select throws_ok(format($$insert into public.event_sponsors (event_id, name) values (%L, 'Sponsor Ltd')$$, :'listing'),
  '23514', null, 'no sponsors or logos on RunLime listings');
select tests.clear_authentication();
select throws_ok(format($$update public.events set registration_url = null where id = %L$$, :'listing'),
  '23514', null, 'database constraint keeps the official link on listings');

-- Admin publishes the listing; the public sees it, with the unaffiliated notice available as a public setting.
select tests.authenticate_as(:'admin', 'aal2');
select lives_ok(format($$select public.review_event(%L, 'published')$$, :'listing'), 'admin publishes the listing');
select tests.authenticate_anon();
select is((select count(*)::int from public.events where id = :'listing'), 1, 'anon can read the published listing');
select ok((select value #>> '{}' from public.app_settings where key = 'events.unaffiliated_notice') like '%not affiliated%', 'unaffiliated notice is a public setting');

-- ---------- Organiser events ----------
select tests.authenticate_as(:'runner');
select throws_ok(format($$select public.save_event(null, %L::jsonb || jsonb_build_object('organisation_id',%L,'region_id',%L), %L)$$,
  :'ev', :'org', tests.area_id('Central'), :'dist'), '42501', null, 'non-members cannot create events for an organisation');

select tests.authenticate_as(:'owner');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('organisation_id', :'org', 'region_id', tests.area_id('Central'), 'name', 'Chaguanas Charity 5K'), :'dist') as e1 \gset
select is((select status::text from public.events where id = :'e1'), 'draft', 'new organiser events start as drafts');
select tests.authenticate_anon();
select is((select count(*)::int from public.events where id = :'e1'), 0, 'drafts are not public');
select tests.authenticate_as(:'owner');
select is(public.submit_event(:'e1')::text, 'pending_approval', 'submitting waits for admin approval');
select tests.authenticate_as(:'admin', 'aal2');
select throws_ok(format($$select public.review_event(%L, 'rejected', '')$$, :'e1'), '22023', null, 'rejection needs a reason');
select lives_ok(format($$select public.review_event(%L, 'published')$$, :'e1'), 'admin approves');

-- Postpone / cancel need a reason and are recorded in the change history.
select tests.authenticate_as(:'owner');
select throws_ok(format($$select public.change_event_status(%L, 'postponed', 'x')$$, :'e1'), '22023', null, 'postponing needs a reason');
select lives_ok(format($$select public.change_event_status(%L, 'postponed', 'Heavy rain forecast', '2031-03-08T06:00:00-04:00')$$, :'e1'), 'organiser postpones with a reason and a new date');
select is((select count(*)::int from public.event_changes where event_id = :'e1' and field in ('status', 'starts_at')), 4,
  'status changes and the new date are recorded (draft→pending, pending→published, published→postponed, new start)');

-- Duplicate for next year.
select public.duplicate_event(:'e1', '2032-03-06T06:00:00-04:00') as e2 \gset
select is((select status::text || '|' || duplicated_from_id::text from public.events where id = :'e2'), 'draft|' || :'e1', 'duplicate is a draft linked to the original');
select is((select count(*)::int from public.event_distances where event_id = :'e2'), 1, 'duplicate copies the distances');

-- Co-organisers.
select tests.authenticate_as(:'helper');
select throws_ok(format($$select public.save_event(%L, %L::jsonb || jsonb_build_object('region_id',%L), %L)$$, :'e2', :'ev', tests.area_id('Central'), :'dist'),
  '42501', null, 'a stranger cannot edit');
select tests.clear_authentication();
select email as helper_email from auth.users where id = :'helper' \gset
select tests.authenticate_as(:'owner');
select lives_ok(format($$select public.invite_co_organiser(%L, %L)$$, :'e2', :'helper_email'), 'owner invites a co-organiser');
select tests.authenticate_as(:'helper');
select ok(not public.can_edit_event(:'e2'), 'invitation alone gives no rights');
select lives_ok(format($$select public.accept_co_organiser(%L)$$, :'e2'), 'helper accepts');
select ok(public.can_edit_event(:'e2'), 'accepted co-organiser can edit');

-- Race suggestions + duplicate detection.
select tests.authenticate_as(:'runner');
select ok(public.suggest_race('Mayaro Beach 5K', '2031-05-01', 'Mayaro', 'https://example.org/mayaro', null) is not null, 'participants can suggest a race');
select tests.authenticate_as(:'owner');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('organisation_id', :'org', 'region_id', tests.area_id('Central'), 'name', 'Chaguanas Charity 5K Run', 'starts_at', '2031-03-08T07:00:00-04:00'), :'dist') as e3 \gset
select public.submit_event(:'e3');
select tests.authenticate_as(:'admin', 'aal2');
select is((select count(*)::int from public.duplicate_candidates where event_id = :'e3' and other_event_id = :'e1'), 1, 'similar race in the same area within a day is flagged');

select * from finish();
rollback;
