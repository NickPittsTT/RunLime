begin;
\ir _helpers.psql
select plan(4);
select tests.create_user('exporter@runlime.test', '1988-08-08') as me \gset
select tests.create_user('someone@runlime.test') as other \gset
select tests.authenticate_as(:'me');
select is(public.export_my_data() -> 'profile' ->> 'date_of_birth', '1988-08-08', 'export contains own profile');
select ok(public.export_my_data() -> 'account' ->> 'email' like 'exporter.%', 'export contains own email');
select ok(position(:'other' in public.export_my_data()::text) = 0, 'export contains nothing about other users');
select tests.authenticate_anon();
select throws_ok($$select public.export_my_data()$$, '42501', null, 'anon cannot export');
select * from finish();
rollback;
