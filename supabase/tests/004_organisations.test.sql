begin;
\ir _helpers.psql
select plan(12);

select tests.create_user('org.owner@runlime.test') as owner \gset
select tests.create_user('other@runlime.test') as other \gset
select tests.create_user('admin@runlime.test') as admin \gset
insert into public.user_roles values (:'admin', 'platform_admin');

select tests.authenticate_as(:'owner');
select public.apply_as_organiser('Savannah Striders', 'hello@striders.tt', '868-555-0100', '', 'Community 5K series around the Queen''s Park Savannah.', false) as org \gset
select is((select status::text from public.organisations where id = :'org'), 'applied', 'application is pending');
select throws_ok($$select public.apply_as_organiser('Second', 'a@b.tt', '868-555-0100', '', 'Another application while one is pending.', false)$$,
  '23505', null, 'only one pending application at a time');
select ok(not public.has_role('organiser'), 'applicant is not yet an organiser');
select throws_ok(format($$select public.review_organisation(%L, 'verified')$$, :'org'), '42501', null, 'applicant cannot verify themselves');

select tests.authenticate_as(:'other');
select is((select count(*)::int from public.organisations), 0, 'non-members cannot see the application');

select tests.authenticate_as(:'admin', 'aal1');
select throws_ok(format($$select public.review_organisation(%L, 'verified')$$, :'org'), '42501', null, 'admin without MFA cannot review');
select tests.authenticate_as(:'admin', 'aal2');
select throws_ok(format($$select public.review_organisation(%L, 'rejected', '')$$, :'org'), '22023', null, 'rejection needs a reason');
select lives_ok(format($$select public.review_organisation(%L, 'verified')$$, :'org'), 'admin with MFA verifies');
select ok(tests.user_has_role('organiser', :'owner'), 'owner now has the organiser role');
select lives_ok(format($$select public.review_organisation(%L, 'suspended', 'Repeated spam broadcasts')$$, :'org'), 'admin suspends');
select ok(not tests.user_has_role('organiser', :'owner'), 'suspension removes the organiser role');

-- rate limit: counts successful applications per day (setting). Failed calls roll back and store nothing.
select tests.clear_authentication();
update public.app_settings set value = '1' where key = 'ratelimit.organiser_applications_per_day';
select tests.authenticate_as(:'other');
select public.apply_as_organiser('First Try', 'a@b.tt', '868-555-0100', '', 'A first application that will be rejected.', false) as org2 \gset
select tests.authenticate_as(:'admin', 'aal2');
select public.review_organisation(:'org2', 'rejected', 'Not a real race organiser');
select tests.authenticate_as(:'other');
select throws_ok($$select public.apply_as_organiser('Second Try', 'a@b.tt', '868-555-0100', '', 'A second application on the same day.', false)$$,
  'P0429', null, 'organiser applications are rate limited');

select * from finish();
rollback;
