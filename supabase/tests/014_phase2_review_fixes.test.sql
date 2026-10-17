begin;
\ir _helpers.psql
select plan(32);

select tests.create_user('admin2@runlime.test') as admin \gset
select tests.create_user('organiser2@runlime.test') as orgr \gset
select tests.create_user('runner2@runlime.test') as runner \gset
insert into public.user_roles values (:'admin', 'platform_admin');
select email as orgr_email from auth.users where id = :'orgr' \gset

\set ev '{"name":"Status Test 5K","starts_at":"2031-04-01T06:00:00-04:00","venue_name":"Queen''s Park Savannah","start_lat":10.67,"start_lng":-61.51,"registration_url":"https://example.org/register"}'
\set dist '[{"km":5,"label":"5K"}]'

select tests.authenticate_as(:'admin', 'aal2');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('listing_source', 'runlime', 'region_id', tests.area_id('Central')), :'dist') as listing \gset
select public.review_event(:'listing', 'published');

-- ---------- 1. Status changes: Publish can't undo a postponement or cancellation ----------
select lives_ok(format($$select public.change_event_status(%L, 'postponed', 'Heavy rain expected', null)$$, :'listing'), 'admin postpones');
select throws_ok(format($$select public.review_event(%L, 'published')$$, :'listing'), '22023', null, 'Publish refuses a postponed race (the reported bug)');
select is((select status::text from public.events where id = :'listing'), 'postponed', 'race stays postponed');
select tests.authenticate_anon();
select is((select status::text from public.events where id = :'listing'), 'postponed', 'the public (and the app) see "postponed"');
select tests.authenticate_as(:'admin', 'aal2');
select lives_ok(format($$select public.change_event_status(%L, 'cancelled', 'Venue unavailable', null)$$, :'listing'), 'postponed race can be cancelled');
select throws_ok(format($$select public.review_event(%L, 'published')$$, :'listing'), '22023', null, 'Publish refuses a cancelled race');
select throws_ok(format($$select public.change_event_status(%L, 'postponed', 'Changed our minds', null)$$, :'listing'), '22023', null, 'cancelled cannot jump to postponed');
select lives_ok(format($$select public.change_event_status(%L, 'published', '', null)$$, :'listing'), 'cancelled race can be put back on explicitly');
select is((select status_reason from public.events where id = :'listing'), null, 'back on clears the reason');
select throws_ok(format($$select public.review_event(%L, 'rejected', 'Not suitable')$$, :'listing'), '22023', null, 'only pending races can be rejected');
select is(
  (select array_agg(new_value order by changed_at, id) from public.event_changes where event_id = :'listing' and field = 'status'),
  array['published', 'postponed', 'cancelled', 'published'], 'change history records each step');

-- ---------- 5. Listing images/sponsors need recorded permission ----------
select throws_ok(format($$insert into public.event_media (event_id, kind, storage_path, alt_text) values (%L, 'flyer', %L, 'Race flyer')$$,
  :'listing', :'listing' || '/f1.png'), '23514', null, 'no flyer before permission is recorded');
select throws_ok(format($$insert into public.event_sponsors (event_id, name) values (%L, 'Credit Union')$$, :'listing'),
  '23514', null, 'no sponsor/logo before permission is recorded');
select tests.authenticate_as(:'admin', 'aal1');
select throws_ok(format($$select public.set_listing_media_permission(%L, true)$$, :'listing'), '42501', null, 'recording permission needs admin MFA');
select tests.authenticate_as(:'admin', 'aal2');
select lives_ok(format($$select public.set_listing_media_permission(%L, true)$$, :'listing'), 'admin records the organiser''s permission');
select is((select media_permission_by from public.events where id = :'listing'), :'admin'::uuid, 'who ticked it is stored');
select ok((select media_permission_at from public.events where id = :'listing') is not null, 'when it was ticked is stored');
select tests.clear_authentication();
select ok(exists (select 1 from audit.log where table_name = 'events' and row_id = :'listing' and 'media_permission_at' = any (changed_fields)
                  and after ? 'media_permission_at' and actor_alias is not null), 'the audit log records the tick with the actor alias');
select ok(not exists (select 1 from audit.log where table_name = 'events' and row_id = :'listing' and after ? 'media_permission_by'),
  'the audit log stores no raw user id');
select tests.authenticate_as(:'admin', 'aal2');
select lives_ok(format($$insert into public.event_media (event_id, kind, storage_path, alt_text) values (%L, 'flyer', %L, 'Race flyer')$$,
  :'listing', :'listing' || '/f2.png'), 'flyer allowed with permission');
select lives_ok(format($$insert into public.event_sponsors (event_id, name) values (%L, 'Credit Union')$$, :'listing'), 'sponsor allowed with permission');
select throws_ok(format($$insert into public.event_media (event_id, kind, storage_path, alt_text) values (%L, 'gallery', %L, 'Photo')$$,
  :'listing', :'listing' || '/g.png'), '23514', null, 'gallery photos stay organiser-only');
select throws_ok(format($$select public.set_listing_media_permission(%L, false)$$, :'listing'), '22023', null, 'permission cannot be withdrawn while images or sponsors exist');

-- ---------- 4. Admin creates a verified organisation ----------
select tests.authenticate_as(:'orgr');
select throws_ok($$select public.admin_create_organisation('Self Made Runners', 'a@b.tt', '868-555-0101', '', 'We organise community fun runs every month.', false, null)$$,
  '42501', null, 'non-admins cannot create organisations directly');
select tests.authenticate_as(:'admin', 'aal2');
select throws_ok($$select public.admin_create_organisation('Unknown Owner Club', 'a@b.tt', '868-555-0101', '', 'We organise community fun runs every month.', false, 'nobody@runlime.test')$$,
  '22023', null, 'owner email must belong to an existing account');
select public.admin_create_organisation('PSCU Credit Union', 'events@pscu.tt', '868-555-0102', 'https://pscu.example', 'Credit union organising its anniversary 5K.', false, upper(:'orgr_email')) as neworg \gset
select is((select status::text from public.organisations where id = :'neworg'), 'verified', 'created as verified');
select is((select role::text from public.organisation_members where organisation_id = :'neworg' and user_id = :'orgr'), 'owner', 'owner linked');
select ok(exists (select 1 from public.user_roles where user_id = :'orgr' and role = 'organiser'), 'owner gets the organiser role');
select tests.clear_authentication();
select ok(exists (select 1 from audit.log where table_name = 'organisations' and row_id = :'neworg' and action = 'insert' and actor_alias is not null),
  'creation is audit-logged with the admin''s alias');

-- ---------- 7. Preferences on the account ----------
select tests.authenticate_as(:'runner');
insert into public.user_preferences (user_id, region_ids, distance_km, onboarded_at) values (:'runner', array[tests.area_id('Central')], array[0, 5]::numeric[], now());
select is((select distance_km from public.user_preferences where user_id = :'runner'), array[0, 5]::numeric[], 'runner saves areas and distances (0 = fun walk / under 5K)');
select ok((public.export_my_data() -> 'preferences' -> 'areas') ? 'Central', 'preferences are in the data export');
select tests.authenticate_as(:'orgr');
select is((select count(*)::int from public.user_preferences), 0, 'others cannot read someone''s preferences');

select * from finish();
rollback;
