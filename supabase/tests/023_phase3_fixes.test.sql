begin;
\ir _helpers.psql
select plan(22);

select tests.create_user('admin23@runlime.test') as admin \gset
select tests.create_user('ana23@runlime.test') as ana \gset
select tests.create_user('lead23@runlime.test') as lead \gset
select tests.create_user('blocked23@runlime.test') as blk \gset
insert into public.user_roles values (:'admin', 'platform_admin');

-- ---------- Push receipts: service role only ----------
select tests.authenticate_as(:'ana');
select throws_ok($$select * from public.push_receipts$$, '42501', null, 'apps cannot read push receipts');
select throws_ok($$insert into public.push_receipts values ('t1', 'ExponentPushToken[x]', now())$$, '42501', null, 'or write them');
select tests.clear_authentication();
select is((select relrowsecurity from pg_class where oid = 'public.push_receipts'::regclass), true, 'push_receipts has RLS on');

-- ---------- Admin alerts: every admin gets a bell entry at once, no names ----------
select tests.authenticate_as(:'ana');
select public.submit_report('child_safety', 'general', null, null, 'Someone at the race seemed unsafe for a child') as r1 \gset
select public.submit_report('spam', 'general', null, null, 'Spam account selling things') as r2 \gset
select tests.authenticate_as(:'admin', 'aal2');
select is((select title from public.notifications where kind = 'report_received' and data ->> 'report_id' = :'r1'), 'Urgent report: a child may be at risk', 'child-safety report: urgent bell entry');
select is((select title from public.notifications where kind = 'report_received' and data ->> 'report_id' = :'r2'), 'New report: Spam or scam', 'other categories: normal bell entry');
select ok((select bool_and(position('ana23' in title || body) = 0) from public.notifications where kind = 'report_received'), 'alerts do not name the reporter');
select tests.authenticate_as(:'ana');
select is((select count(*)::int from public.notifications where kind = 'report_received'), 0, 'non-admins get no report alerts');
select tests.clear_authentication();
select is((select alert_emailed_at from public.reports where id = :'r1'), null, 'child-safety report waits for the urgent email');
select is((select summary_emailed_at from public.reports where id = :'r2'), null, 'other reports wait for the daily summary');
select is(public.report_category_label('impersonation'), 'Pretending to be someone else', 'category labels match the app');
select tests.authenticate_as(:'admin', 'aal2');
select throws_ok($$select public.set_admin_alerts_config('https://x.example/f', repeat('s', 40))$$, '42501', null, 'only the service role configures alert emails');
select throws_ok($$select public.dispatch_admin_alerts(false)$$, '42501', null, 'apps cannot trigger alert emails');

-- ---------- Club leadership ----------
select tests.clear_authentication();
select email as lead_email from auth.users where id = :'lead' \gset
select email as blk_email from auth.users where id = :'blk' \gset
select tests.authenticate_as(:'blk');
select public.block_user(:'ana');
select tests.authenticate_as(:'ana');
select throws_ok($$select public.request_new_club('Ghost Club', null, null, 'nobody23@runlime.test')$$, '22023', null, 'unknown leader email is refused');
select throws_ok(format($$select public.request_new_club('Blocked Club', null, null, %L)$$, :'blk_email'), '22023', null, 'a blocked person cannot be named (same message)');
select public.request_new_club('Belmont Striders', 'Evening runs', null, ' ' || upper(:'lead_email') || ' ') as req \gset
select public.request_new_club('Ana Runners') as req_me \gset
select tests.authenticate_as(:'admin', 'aal2');
select is((select proposed_leader from public.admin_club_requests() where id = :'req'), 'lead23', 'admin sees the proposed leader');
select is((select leader_is_requester from public.admin_club_requests() where id = :'req'), false, '…and that it is someone else');
select is((select leader_is_requester from public.admin_club_requests() where id = :'req_me'), true, 'no email: the requester leads');
select public.admin_review_club_request(:'req', true, true, null) as club \gset
select is((select role::text from public.club_members where club_id = :'club' and user_id = :'lead'), 'leader', 'the proposed leader leads the new club');
select is((select role::text from public.club_members where club_id = :'club' and user_id = :'ana'), 'member', 'the requester joins as a member');
select tests.authenticate_as(:'lead');
select is((select title || ' ' || body from public.notifications where kind = 'club_leader_assigned'), 'You now lead Belmont Striders. You''ll approve join requests.', 'the leader is told');
select tests.authenticate_as(:'ana');
select is((public.club_page(:'club') -> 'leaders' -> 0 ->> 'display_name'), 'lead23', 'members see the leader name');
select tests.authenticate_as(:'admin', 'aal2');
select public.admin_set_club_leader(:'club', :'ana', true);
select tests.authenticate_as(:'ana');
select is((select count(*)::int from public.notifications where kind = 'club_leader_assigned'), 1, 'an admin appointment also tells the new leader');

select * from finish();
rollback;
