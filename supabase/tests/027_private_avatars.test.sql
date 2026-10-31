-- Owner retest R9 + decision 4 (2026-10-31): a Private account's photo shows only to the person, approved followers
-- and MFA admins; switching to Public shows it to everyone signed in at once, and back to Private hides it again.
-- The photo files follow the same rule (private bucket; storage reads and signed URLs go through this policy).
begin;
\ir _helpers.psql
select plan(23);

select tests.create_user('ana27@runlime.test') as ana \gset
select tests.create_user('ben27@runlime.test') as ben \gset
select tests.create_user('fan27@runlime.test') as fan \gset
select tests.create_user('admin27@runlime.test') as admin \gset
insert into public.user_roles values (:'admin', 'platform_admin');
select :'ana' || '/0123456789abcdef0123456789abcdef.jpg' as file \gset
update public.profiles set avatar_path = :'file' where id = :'ana';
insert into storage.objects (bucket_id, name) values ('avatars', :'file');

select is((select public from storage.buckets where id = 'avatars'), false, 'the photos bucket is private (no public links)');

-- Private: Ben (not following) sees initials and cannot read or sign the file.
select tests.authenticate_as(:'ben');
select is(public.profile_card(:'ana') ->> 'avatar_path', null, 'Private: a non-follower gets no photo on the profile');
select is((select avatar_path from public.search_people('ana27') limit 1), null, 'or in search');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = :'file'), 0, 'and cannot read the file');

-- Ana switches to Public (as the app does: a profile update by Ana).
select tests.authenticate_as(:'ana');
update public.profiles set account_privacy = 'public' where id = :'ana';
select tests.authenticate_as(:'ben');
select is(public.profile_card(:'ana') ->> 'avatar_path', :'file', 'Public: the same viewer now gets the photo on the profile, at once');
select is((select avatar_path from public.search_people('ana27') limit 1), :'file', 'and in search');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = :'file'), 1, 'and can read (sign) the file');

-- Back to Private: hidden again.
select tests.authenticate_as(:'ana');
update public.profiles set account_privacy = 'private' where id = :'ana';
select tests.authenticate_as(:'ben');
select is(public.profile_card(:'ana') ->> 'avatar_path', null, 'back to Private: initials again on the profile');
select is((select avatar_path from public.search_people('ana27') limit 1), null, 'and in search');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = :'file'), 0, 'and the file is closed again');

-- An approved follower sees it; a pending request does not.
select tests.authenticate_as(:'fan');
select public.follow_user(:'ana');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = :'file'), 0, 'a pending follow request is not enough');
select tests.authenticate_as(:'ana');
select public.respond_follow_request(:'fan', true);
select tests.authenticate_as(:'fan');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = :'file'), 1, 'an approved follower can read the file');
select is(public.profile_card(:'ana') ->> 'avatar_path', :'file', 'and sees the photo');

-- The person and MFA admins always; admins without MFA and signed-out visitors never.
select tests.authenticate_as(:'ana');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = :'file'), 1, 'the person reads their own photo');
select tests.authenticate_as(:'admin', 'aal2');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = :'file'), 1, 'an MFA admin can read it (Reports queue)');
select tests.authenticate_as(:'admin', 'aal1');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = :'file'), 0, 'an admin without MFA cannot');
select tests.authenticate_anon();
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0, 'signed-out visitors read no photos');

-- Blocking hides the photo even from a former follower, even on a Public account.
select tests.authenticate_as(:'ana');
update public.profiles set account_privacy = 'public' where id = :'ana';
select public.block_user(:'fan');
select tests.authenticate_as(:'fan');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars' and name = :'file'), 0, 'a blocked account cannot read the photo');
select is(public.can_view_avatar(:'ana'), false, 'can_view_avatar agrees');

-- Malformed file names never pass (and never error).
select is(public.can_view_avatar_file('not-a-uuid/x.jpg'), false, 'a file outside an owner folder is never readable');
select is(public.can_view_avatar_file(null), false, 'nor an empty name');

-- Only reads: nobody but the photo service writes the bucket.
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and (qual ilike '%avatar%' or with_check ilike '%avatar%') and cmd <> 'SELECT'), 0, 'no user write policies on the photos bucket');
select tests.clear_authentication();
select is((select count(*)::int from information_schema.routine_privileges
            where routine_schema = 'public' and routine_name in ('can_view_avatar', 'can_view_avatar_file') and grantee in ('anon', 'PUBLIC')), 0,
  'signed-out visitors cannot call the photo rule');

select * from finish();
rollback;
