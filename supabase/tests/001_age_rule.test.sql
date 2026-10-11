-- AGE POLICY (hard rule): every account holder is 18+. Device, hook, trigger and RPC all enforce it.
begin;
\ir _helpers.psql
select plan(19);

-- is_adult() boundaries (reference date injected) ------------------------------------------
select ok(public.is_adult('2008-10-11', '2026-10-11'), 'turning 18 today is allowed');
select ok(not public.is_adult('2008-10-12', '2026-10-11'), 'turning 18 tomorrow is blocked');
select ok(not public.is_adult('2015-06-01', '2026-10-11'), 'a child is blocked');
select ok(not public.is_adult(null, '2026-10-11'), 'missing DOB is blocked');
select ok(not public.is_adult('2008-02-29', '2026-02-28'), 'leap-day birthday: still 17 on 28 Feb');
select ok(public.is_adult('2008-02-29', '2026-03-01'), 'leap-day birthday: 18 on 1 Mar');

-- the rule is not a setting ----------------------------------------------------------------
select throws_ok(
  $$insert into public.app_settings (key, value) values ('account.minimum_age', '13')$$,
  '23514', null, 'an age setting cannot be created');

-- before_user_created hook ------------------------------------------------------------------
select is(public.hook_before_user_created('{"user":{"app_metadata":{"provider":"email"},"user_metadata":{}}}') -> 'error' ->> 'http_code',
  '403', 'hook rejects email sign-up without DOB');
select is(public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('app_metadata', '{"provider":"email"}'::jsonb,
  'user_metadata', jsonb_build_object('date_of_birth', (public.age_reference_date() - interval '17 years')::date)))) -> 'error' ->> 'http_code',
  '403', 'hook rejects a 17-year-old');
select is(public.hook_before_user_created('{"user":{"app_metadata":{"provider":"email"},"user_metadata":{"date_of_birth":"not-a-date"}}}') -> 'error' ->> 'http_code',
  '403', 'hook rejects a malformed DOB');
select is(public.hook_before_user_created('{"user":{"app_metadata":{"provider":"email"},"user_metadata":{"date_of_birth":"1990-01-01"}}}'),
  '{}'::jsonb, 'hook admits an adult email sign-up');
select is(public.hook_before_user_created('{"user":{"app_metadata":{"provider":"phone"},"user_metadata":{"date_of_birth":"1990-01-01"}}}') -> 'error' ->> 'http_code',
  '403', 'hook rejects unsupported providers (phone)');
select is(public.hook_before_user_created('{"user":{"app_metadata":{"provider":"google"},"user_metadata":{}}}'),
  '{}'::jsonb, 'Google/Apple are admitted but inert until complete_signup');

-- profiles trigger (applies to every role, including service code) ---------------------------
select throws_ok(
  $$select tests.create_user('teen@runlime.test', (public.age_reference_date() - interval '16 years')::date)$$,
  '23514', 'RunLime accounts are for adults aged 18 and over.', 'profile insert for a 16-year-old fails');

select tests.create_user('adult@runlime.test', '1990-01-01') as adult \gset
select throws_ok(
  format($$update public.profiles set date_of_birth = %L where id = %L$$, (public.age_reference_date() - interval '10 years')::date, :'adult'),
  '23514', null, 'changing DOB to under-18 fails');

-- complete_signup under-18: auth user deleted, nothing stored ---------------------------------
select tests.create_user('oauth-kid@runlime.test', null, false) as kid \gset
select tests.authenticate_as(:'kid');
select is(public.complete_signup((public.age_reference_date() - interval '15 years')::date, 'Kid', null, tests.area_id(), 'v1', 'v1') ->> 'status',
  'blocked', 'complete_signup reports blocked for an under-18');
select tests.clear_authentication();
select is((select count(*)::int from auth.users where id = :'kid'), 0, 'blocked user''s auth row is deleted');
select is((select count(*)::int from public.profiles where id = :'kid') + (select count(*)::int from public.consents where user_id = :'kid'),
  0, 'nothing about the blocked user is stored');

-- complete_signup adult -----------------------------------------------------------------------
select tests.create_user('oauth-adult@runlime.test', null, false) as grown \gset
update auth.users set raw_user_meta_data = '{"date_of_birth":"1985-03-03"}' where id = :'grown';
select tests.authenticate_as(:'grown');
select is(public.complete_signup('1985-03-03', 'Grown Up', 'grownup', tests.area_id(), 'v1', 'v1') ->> 'status', 'ok', 'adult completes sign-up');

select * from finish();
rollback;
