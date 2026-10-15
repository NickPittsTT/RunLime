begin;
\ir _helpers.psql
select plan(5);

select tests.create_user('admin@runlime.test') as admin \gset
select tests.create_user('runner@runlime.test') as runner \gset
insert into public.user_roles values (:'admin', 'platform_admin');

select is((select is_public from public.app_settings where key = 'legal.operator_address'), false, 'operator address is marked non-public');

select tests.authenticate_anon();
select is((select count(*)::int from public.app_settings where key = 'legal.operator_address'), 0, 'anonymous visitors cannot read the operator address');
select is((select count(*)::int from public.app_settings where key = 'legal.operator_name'), 1, 'the operator name stays public');

select tests.authenticate_as(:'runner');
select is((select count(*)::int from public.app_settings where key = 'legal.operator_address'), 0, 'signed-in participants cannot read the operator address');

select tests.authenticate_as(:'admin', 'aal2');
select is((select count(*)::int from public.app_settings where key = 'legal.operator_address'), 1, 'admins with MFA can read it for official records');

select * from finish();
rollback;
