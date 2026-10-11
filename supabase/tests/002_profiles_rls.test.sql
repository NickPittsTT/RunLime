begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('alice@runlime.test') as alice \gset
select tests.create_user('bob@runlime.test') as bob \gset
insert into public.profile_private (user_id, emergency_contact_ciphertext, key_version) values (:'alice', 'v1:aaa:bbb', 1);

-- anon sees nothing personal
select tests.authenticate_anon();
select throws_ok($$select count(*) from public.profiles$$, '42501', null, 'anon has no access to profiles');
select throws_ok($$select count(*) from public.profile_private$$, '42501', null, 'anon has no access to profile_private');
select ok((select count(*) from public.regions) > 0, 'anon can read regions (reference data)');

-- a user sees only their own rows
select tests.authenticate_as(:'bob');
select is((select count(*)::int from public.profiles), 1, 'bob sees exactly one profile');
select is((select id from public.profiles), :'bob'::uuid, '... and it is his own');
select is((select count(*)::int from public.profile_private), 0, 'bob cannot read alice''s emergency contact');
select is((select count(*)::int from public.consents where user_id = :'alice'), 0, 'bob cannot read alice''s consents');

-- column privileges: DOB is fixed, editable fields work
select throws_ok(format($$update public.profiles set date_of_birth = '1970-01-01' where id = %L$$, :'bob'), '42501', null, 'users cannot change their DOB');
select lives_ok(format($$update public.profiles set display_name = 'Bobby', account_privacy = 'public' where id = %L$$, :'bob'), 'users can edit display name and privacy');
update public.profiles set display_name = 'hacked' where id = :'alice';
select throws_ok($$insert into public.profiles (id, display_name, date_of_birth, home_region_id) values (gen_random_uuid(), 'x', '1990-01-01', gen_random_uuid())$$,
  '42501', null, 'users cannot insert profiles directly (only complete_signup)');
select throws_ok(format($$insert into public.user_roles (user_id, role) values (%L, 'super_admin')$$, :'bob'), '42501', null, 'users cannot grant themselves roles');

-- even an MFA-verified admin cannot read emergency contacts
select tests.clear_authentication();
select tests.create_user('admin@runlime.test') as admin \gset
insert into public.user_roles values (:'admin', 'platform_admin');
select tests.authenticate_as(:'admin', 'aal2');
select is((select count(*)::int from public.profile_private), 0, 'admins cannot read emergency contacts');
select tests.clear_authentication();
select is((select display_name from public.profiles where id = :'alice'), 'alice', 'alice''s profile was not changed by bob');

-- a signed-in user without a profile (incomplete OAuth sign-up) can do nothing
select tests.create_user('pending@runlime.test', null, false) as pending \gset
select tests.authenticate_as(:'pending');
select throws_ok($$select public.apply_as_organiser('Pending Org', 'p@x.tt', '868-555-0100', null, 'An organisation that should be refused.', false)$$,
  '42501', null, 'profile-less users cannot use RPCs');

select * from finish();
rollback;
