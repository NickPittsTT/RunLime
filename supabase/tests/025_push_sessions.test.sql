-- B1 (owner retest 2026-10-30): a phone token belongs to at most one signed-in account; sign-out, switching and
-- account deletion detach it on the server; notifications only go to phones whose sign-in session is alive.
begin;
\ir _helpers.psql
select plan(14);

select tests.create_user('ana25@runlime.test') as ana \gset
select tests.create_user('ben25@runlime.test') as ben \gset
select tests.new_session(:'ana') as ana_s \gset
select tests.new_session(:'ben') as ben_s \gset

-- Sign-in attaches the phone to that account and session.
select tests.authenticate_as(:'ana', 'aal1', :'ana_s');
select public.register_push_token('ExponentPushToken[phone1]', 'android');
select tests.clear_authentication();
select is((select session_id from public.push_tokens where token = 'ExponentPushToken[phone1]'), :'ana_s'::uuid, 'the token records the sign-in session');
select is((select array_agg(user_id) from public.push_targets(array[:'ana'::uuid])), array[:'ana'::uuid], 'Ana''s phone gets Ana''s notifications');

-- No session in the JWT (e.g. a service call) cannot register a phone.
select set_config('request.jwt.claims', json_build_object('sub', :'ana', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok($$select public.register_push_token('ExponentPushToken[phone9]', 'android')$$, '28000', null, 'registering needs a sign-in session');
reset role;
select tests.clear_authentication();

-- Switching accounts on the same phone: the token moves; Ana stops getting pushes on it.
select tests.authenticate_as(:'ben', 'aal1', :'ben_s');
select public.register_push_token('ExponentPushToken[phone1]', 'android');
select tests.clear_authentication();
select is((select count(*)::int from public.push_tokens where token = 'ExponentPushToken[phone1]'), 1, 'one row per phone');
select is((select count(*)::int from public.push_targets(array[:'ana'::uuid])), 0, 'after switching, Ana gets nothing on that phone');
select is((select count(*)::int from public.push_targets(array[:'ben'::uuid])), 1, 'Ben does');

-- Sign-out that never reached our unregister: Supabase ends the session → the phone gets nothing.
delete from auth.sessions where id = :'ben_s';
select is((select count(*)::int from public.push_targets(array[:'ben'::uuid])), 0, 'a signed-out phone gets no notifications, even if its token row survived');
select ok(public.purge_orphan_push_tokens() >= 1, 'and the hourly clean-up removes the row');
select is((select count(*)::int from public.push_tokens where token = 'ExponentPushToken[phone1]'), 0, 'gone');

-- The phone can remove its own token when signed out (retry after an offline sign-out).
select tests.authenticate_as(:'ana', 'aal1', :'ana_s');
select public.register_push_token('ExponentPushToken[phone2]', 'android');
select tests.authenticate_anon();
select lives_ok($$select public.unregister_push_token('ExponentPushToken[phone2]')$$, 'signed out, the phone can still remove its token');
select tests.clear_authentication();
select is((select count(*)::int from public.push_tokens where token = 'ExponentPushToken[phone2]'), 0, 'removed');

-- Account deletion removes the account's phones.
select tests.authenticate_as(:'ana', 'aal1', :'ana_s');
select public.register_push_token('ExponentPushToken[phone3]', 'android');
select public.delete_my_account();
select tests.clear_authentication();
select is((select count(*)::int from public.push_tokens where token = 'ExponentPushToken[phone3]'), 0, 'deleting the account removes its phone tokens');

-- Only the server reads targets or purges.
select tests.authenticate_as(:'ben');
select throws_ok($$select * from public.push_targets(array[auth.uid()])$$, '42501', null, 'apps cannot list push targets');
select throws_ok($$select public.purge_orphan_push_tokens()$$, '42501', null, 'or purge tokens');

select * from finish();
rollback;
