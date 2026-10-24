begin;
\ir _helpers.psql
select plan(12);

select tests.create_user('super@runlime.test') as super \gset
select tests.create_user('padmin@runlime.test') as padmin \gset
select tests.create_user('runner@runlime.test') as runner \gset
insert into public.user_roles values (:'super', 'super_admin'), (:'padmin', 'platform_admin');

-- Admin rights require aal2 (TOTP verified)
select tests.authenticate_as(:'padmin', 'aal1');
select ok(not public.is_admin(), 'platform admin without MFA is not an admin');
select throws_ok($$select * from public.admin_list_users()$$, '42501', 'Admin access requires MFA', 'user list refused without MFA');
select tests.authenticate_as(:'padmin', 'aal2');
select ok(public.is_admin(), 'platform admin with MFA is an admin');
select ok((select count(*) from public.admin_list_users()) >= 3, 'admin can list users with MFA');
select is((select count(*)::int from public.admin_list_users() where email is null), 0, 'admin list has emails but no DOB column');

-- Only the super admin (with MFA) can grant/revoke platform_admin
select throws_ok(format($$select public.set_platform_admin(%L, true)$$, :'runner'), '42501', null, 'platform admin cannot grant platform_admin');
select tests.authenticate_as(:'super', 'aal1');
select throws_ok(format($$select public.set_platform_admin(%L, true)$$, :'runner'), '42501', null, 'super admin without MFA cannot grant');
select tests.authenticate_as(:'super', 'aal2');
select lives_ok(format($$select public.set_platform_admin(%L, true)$$, :'runner'), 'super admin with MFA can grant');
select ok(tests.user_has_role('platform_admin', :'runner'), 'runner is now a platform admin');
select lives_ok(format($$select public.set_platform_admin(%L, false)$$, :'runner'), 'super admin can revoke');
select ok(not tests.user_has_role('platform_admin', :'runner'), 'role revoked');
select throws_ok(format($$select public.set_platform_admin(%L, false)$$, :'super'), '42501', null, 'super admin cannot change own role');

select * from finish();
rollback;
