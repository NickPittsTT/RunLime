begin;
\ir _helpers.psql
select plan(6);

select tests.create_user('leaver@runlime.test') as leaver \gset
insert into public.profile_private values (:'leaver', 'v1:x:y', 1, now());
insert into public.consents (user_id, kind, version) values (:'leaver', 'terms', 'v1');

select tests.authenticate_as(:'leaver');
select lives_ok($$select public.delete_my_account()$$, 'user deletes their account');
select tests.clear_authentication();
select is((select count(*)::int from auth.users where id = :'leaver'), 0, 'auth user gone');
select is((select count(*)::int from public.profiles where id = :'leaver'), 0, 'profile gone');
select is((select count(*)::int from public.profile_private where user_id = :'leaver') + (select count(*)::int from public.consents where user_id = :'leaver')
          + (select count(*)::int from public.user_roles where user_id = :'leaver'), 0, 'all personal rows gone');

-- incomplete sign-ups are purged after an hour
select tests.create_user('stale@runlime.test', null, false) as stale \gset
update auth.users set created_at = now() - interval '2 hours' where id = :'stale';
select tests.create_user('fresh@runlime.test', null, false) as fresh \gset
select public.purge_incomplete_signups();
select is((select count(*)::int from auth.users where id = :'stale'), 0, 'profile-less user older than 1h purged');
select is((select count(*)::int from auth.users where id = :'fresh'), 1, 'recent incomplete sign-up kept (still in the age gate flow)');

select * from finish();
rollback;
