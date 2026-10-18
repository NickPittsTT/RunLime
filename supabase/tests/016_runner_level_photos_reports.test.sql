begin;
\ir _helpers.psql
select plan(30);

select tests.create_user('runner16@runlime.test') as runner \gset
select tests.create_user('other16@runlime.test') as other \gset
select tests.create_user('admin16@runlime.test') as admin \gset
insert into public.user_roles values (:'admin', 'platform_admin');

-- ---------- Runner level ----------
select tests.authenticate_as(:'runner');
select lives_ok(format($$update public.profiles set runner_level = 'club_runner' where id = %L$$, :'runner'), 'a runner sets their level');
select is((select runner_level::text from public.profiles where id = :'runner'), 'club_runner', 'level saved');
select lives_ok(format($$update public.profiles set runner_level = null where id = %L$$, :'runner'), 'level is optional (can be cleared)');
select throws_ok(format($$update public.profiles set runner_level = 'elite' where id = %L$$, :'runner'), '22P02', null, 'only Casual / Club runner / Competitive');

-- ---------- Profile photos: only the Edge Function (service role) writes them ----------
select throws_ok(format($$update public.profiles set avatar_path = %L where id = %L$$, :'runner' || '/0123456789abcdef0123456789abcdef.jpg', :'runner'),
  '42501', null, 'users cannot set their photo path directly');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and (qual ilike '%avatars%' or with_check ilike '%avatars%') and cmd in ('INSERT', 'UPDATE', 'DELETE')), 0,
  'no user write policies on the avatars bucket');
select tests.clear_authentication();
select is((select public from storage.buckets where id = 'avatars'), true, 'avatars bucket exists (public read)');
select is((select allowed_mime_types from storage.buckets where id = 'avatars'), array['image/jpeg'], 'JPEG only (metadata stripped on upload)');
update public.profiles set avatar_path = :'runner' || '/0123456789abcdef0123456789abcdef.jpg', avatar_updated_at = now() where id = :'runner';
select throws_ok(format($$update public.profiles set avatar_path = 'elsewhere/x.png' where id = %L$$, :'runner'), '23514', null, 'photo path format enforced');

-- ---------- Reports ----------
select tests.authenticate_as(:'other');
select throws_ok(format($$select public.submit_report('sexual_content', 'profile_photo', %L)$$, :'other'), '22023', null, 'cannot report yourself');
select public.submit_report('sexual_content', 'profile_photo', :'runner', null, 'Not a running photo') as rep1 \gset
select is((select target_ref from public.reports where id = :'rep1'), :'runner' || '/0123456789abcdef0123456789abcdef.jpg', 'the reported photo is captured');
select is((select count(*)::int from public.reports), 1, 'reporters see their own reports');
select throws_ok($$select public.submit_report('child_safety', 'general', null, null, 'short')$$, '22023', null, 'a safety concern needs a description');
select public.submit_report('child_safety', 'general', null, null, 'Someone in a race group is asking for photos of kids') as rep2 \gset
select throws_ok($$insert into public.reports (category, target_kind, details) values ('spam', 'general', 'direct insert attempt')$$,
  '42501', null, 'reports are only sent through submit_report');
select throws_ok(format($$select public.submit_report('other', 'profile_photo', %L)$$, :'other'), '22023', null,
  'reporting a photo needs the person to have one (and not yourself)');

select tests.authenticate_as(:'runner');
select is((select count(*)::int from public.reports), 0, 'the reported person cannot see reports about them');
select throws_ok($$select * from public.admin_reports()$$, '42501', null, 'the queue is admins only');

-- Rate limit
select tests.clear_authentication();
update public.app_settings set value = '"3"' where key = 'moderation.reports_per_hour';
select tests.authenticate_as(:'other');
select public.submit_report('spam', 'profile', :'runner', null, 'one more report');
select throws_ok(format($$select public.submit_report('spam', 'profile', %L, null, 'and another')$$, :'runner'), 'P0429', null, 'reports are rate limited (setting)');

-- ---------- Admin queue and removal ----------
select tests.authenticate_as(:'admin', 'aal1');
select throws_ok($$select * from public.admin_reports()$$, '42501', null, 'admin queue needs MFA');
select tests.authenticate_as(:'admin', 'aal2');
select is((select category::text from public.admin_reports() limit 1), 'child_safety', 'child-safety reports come first');
select is((select count(*)::int from public.admin_reports() r where r.target_user_id = :'runner' or r.id = :'rep2'), 3, 'all open reports listed');
select is((select target_name from public.admin_reports() where id = :'rep1'), 'runner16', 'admins see who was reported');
select is(public.admin_remove_avatar(:'runner', :'rep1', 'Not a profile photo'), :'runner' || '/0123456789abcdef0123456789abcdef.jpg',
  'removal returns the file path so the function can delete the file');
select is((select avatar_path from public.profiles where id = :'runner'), null, 'photo removed from the profile');
select is((select status::text from public.reports where id = :'rep1'), 'actioned', 'the report is closed as actioned');
select lives_ok(format($$select public.admin_resolve_report(%L, 'dismissed', 'Not enough detail')$$, :'rep2'), 'admin dismisses a report');
select throws_ok(format($$select public.admin_resolve_report(%L, 'dismissed')$$, :'rep2'), 'P0002', null, 'a closed report cannot be resolved twice');
select tests.clear_authentication();
select ok(exists (select 1 from audit.log where table_name = 'reports' and after ->> 'id' = :'rep1' and action = 'update'
                  and after ->> 'status' = 'actioned' and actor_alias is not null and subject_alias is not null),
  'removal is audit-logged with the admin and the reported person as aliases');
select ok(not exists (select 1 from audit.log where table_name = 'reports' and (after ? 'reporter_id' or after ? 'details' or after ? 'target_user_id')),
  'the audit log never stores the reporter, report text or raw user ids');

-- ---------- Export ----------
select tests.authenticate_as(:'other');
select is(jsonb_array_length(public.export_my_data() -> 'reports_sent'), 3, 'reports a person sent are in their data export');

select * from finish();
rollback;
