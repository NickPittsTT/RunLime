begin;
\ir _helpers.psql
select plan(12);

select tests.create_user('ana21@runlime.test') as ana \gset
select tests.create_user('ben21@runlime.test') as ben \gset

select tests.authenticate_as(:'ana');
select lives_ok($$select public.register_push_token('ExponentPushToken[abc123]', 'android')$$, 'a phone registers its push token');
select throws_ok($$select public.register_push_token('not-a-token', 'android')$$, '23514', null, 'only Expo push tokens are accepted');
select is((select count(*)::int from public.push_tokens), 1, 'own token visible');
select throws_ok($$insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[x]', auth.uid(), 'android')$$, '42501', null, 'tokens only through register_push_token');

-- The same phone signed in by someone else now belongs to them.
select tests.authenticate_as(:'ben');
select public.register_push_token('ExponentPushToken[abc123]', 'android');
select is((select count(*)::int from public.push_tokens), 1, 'Ben now owns the phone token');
select tests.authenticate_as(:'ana');
select is((select count(*)::int from public.push_tokens), 0, 'and Ana no longer gets pushes on it');
select tests.authenticate_as(:'ben');
select public.unregister_push_token('ExponentPushToken[abc123]');
select is((select count(*)::int from public.push_tokens), 0, 'signing out removes the token');

-- Dispatch: off until configured; configuration only by the service role.
select throws_ok($$select public.set_push_config('https://example.org/x', repeat('s', 40))$$, '42501', null, 'users cannot configure push');
select tests.clear_authentication();
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[ana-phone]', :'ana', 'android');
insert into public.notifications (user_id, kind, title) values (:'ana', 'new_follower', 'Test push');
delete from vault.secrets where name in ('push_dispatch_url', 'push_dispatch_secret');
select is(public.dispatch_push(), false, 'not configured: nothing is sent (the inbox still works)');
set local role service_role;
select lives_ok($$select public.set_push_config('http://127.0.0.1:9/push-dispatch', repeat('s', 40))$$, 'the service role stores the URL and secret in Vault');
reset role;
select is(public.dispatch_push(), true, 'configured + something to send: the Edge Function is called');
select tests.authenticate_as(:'ana');
select is(jsonb_array_length(public.export_my_data() -> 'push_devices'), 1, 'registered phones are in the data export (platform and dates only)');
