begin;
\ir _helpers.psql
select plan(30);

select tests.create_user('admin19@runlime.test') as admin \gset
select tests.create_user('lead19@runlime.test') as lead \gset
select tests.create_user('ana19@runlime.test') as ana \gset
select tests.create_user('ben19@runlime.test') as ben \gset
insert into public.user_roles values (:'admin', 'platform_admin');

-- ---------- New-club request → admin approves → requester is the first leader ----------
select tests.authenticate_as(:'lead');
select throws_ok($$select public.request_new_club('X')$$, '22023', null, 'club name needs 2+ characters');
select public.request_new_club('Maraval Morning Milers', 'Saturday 6 am runs', tests.area_id('Central')) as req \gset
select throws_ok($$select * from public.admin_club_requests()$$, '42501', null, 'only admins see new-club requests');
select tests.authenticate_as(:'admin', 'aal2');
select is((select name from public.admin_club_requests() where id = :'req'), 'Maraval Morning Milers', 'admin sees the request');
select throws_ok(format($$select public.admin_review_club_request(%L, false, false, 'no')$$, :'req'), '22023', null, 'rejecting needs a reason');
select public.admin_review_club_request(:'req', true, true, null) as club \gset
select is((select role::text || ' ' || status::text from public.club_members where club_id = :'club' and user_id = :'lead'), 'leader approved', 'the requester leads the new club');
select tests.authenticate_as(:'ana');
select throws_ok($$select public.request_new_club('maraval morning milers')$$, '22023', null, 'an existing club cannot be requested again');

-- ---------- Joining needs a leader's approval ----------
select is(public.request_join_club(:'club')::text, 'pending', 'Ana asks to join');
select throws_ok(format($$select public.set_primary_club(%L)$$, :'club'), '22023', null, 'a pending membership cannot be primary');
select throws_ok(format($$select public.respond_club_request(%L, %L, true)$$, :'club', :'ana'), '42501', null, 'members cannot approve themselves');
select tests.authenticate_as(:'ben');
select public.request_join_club(:'club');
select throws_ok(format($$select public.respond_club_request(%L, %L, true)$$, :'club', :'ana'), '42501', null, 'non-leaders cannot approve');
select tests.authenticate_as(:'lead');
select is(jsonb_array_length(public.club_page(:'club') -> 'requests'), 2, 'the leader sees 2 requests');
select lives_ok(format($$select public.respond_club_request(%L, %L, true)$$, :'club', :'ana'), 'the leader approves Ana');
select lives_ok(format($$select public.respond_club_request(%L, %L, false)$$, :'club', :'ben'), 'and declines Ben');
select is((select members from public.club_directory() where id = :'club'), 2, 'only approved members count (leader + Ana)');
select tests.authenticate_as(:'ana');
select is((select my_status::text from public.club_directory() where id = :'club'), 'approved', 'Ana sees she is approved');
select is(public.club_page(:'club') -> 'requests', 'null'::jsonb, 'members do not see the request list');
select is(public.club_page(:'club') -> 'member_list', 'null'::jsonb, 'or the member list');

-- ---------- One primary club ----------
select tests.authenticate_as(:'admin', 'aal2');
insert into public.clubs (name) values ('Second Club 19') returning id as club2 \gset
select public.admin_set_club_leader(:'club2', :'ana', false);
select tests.authenticate_as(:'ana');
select lives_ok(format($$select public.set_primary_club(%L)$$, :'club'), 'Ana picks her primary club');
select lives_ok(format($$select public.set_primary_club(%L)$$, :'club2'), 'and switches it');
select is((select count(*)::int from public.club_members where user_id = :'ana' and is_primary), 1, 'only one primary club');
select is((select club_id from public.club_members where user_id = :'ana' and is_primary), :'club2'::uuid, 'the new one');

-- ---------- Removing members ----------
select tests.authenticate_as(:'lead');
select throws_ok(format($$select public.remove_club_member(%L, %L)$$, :'club', :'lead'), '22023', null, 'leaders leave with Leave club, not remove');
select tests.authenticate_as(:'ana');
select throws_ok(format($$select public.remove_club_member(%L, %L)$$, :'club', :'lead'), '42501', null, 'members cannot remove a leader');

-- ---------- Turnout: counts only, opted-in approved members, hidden below the minimum ----------
\set ev '{"name":"Turnout 5K","starts_at":"2031-07-01T06:00:00-04:00","venue_name":"Savannah","start_lat":10.67,"start_lng":-61.51,"registration_url":"https://example.org/r"}'
select tests.authenticate_as(:'admin', 'aal2');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('listing_source', 'runlime', 'region_id', tests.area_id('Central')), '[{"km":5,"label":"5K"}]') as race \gset
select public.review_event(:'race', 'published');
select tests.clear_authentication();
update public.profiles set show_attendance_to_clubs = true where id in (:'lead', :'ana');
update public.app_settings set value = '"2"' where key = 'clubs.turnout_min';
select tests.authenticate_as(:'lead');
select public.set_rsvp(:'race', 'going', 1, 0);
select tests.authenticate_anon();
select is((select count(*)::int from public.club_turnout(:'race')), 0, 'one member going: below the minimum, hidden');
select tests.authenticate_as(:'ana');
select public.set_rsvp(:'race', 'going', 1, 0);
select tests.authenticate_as(:'ben');
select public.set_rsvp(:'race', 'going', 1, 0); -- declined from the club: not counted
select tests.authenticate_anon();
select is((select going from public.club_turnout(:'race') where club_id = :'club'), 2, 'two opted-in approved members going: shown as a count');
select tests.clear_authentication();
update public.profiles set show_attendance_to_clubs = false where id = :'ana';
select tests.authenticate_anon();
select is((select count(*)::int from public.club_turnout(:'race') where club_id = :'club'), 0, 'opting out drops the count below the minimum');

-- ---------- Leaving, audit, export ----------
select tests.authenticate_as(:'ana');
select lives_ok(format($$select public.leave_club(%L)$$, :'club'), 'Ana leaves');
select throws_ok(format($$insert into public.club_members (club_id, user_id, status) values (%L, %L, 'approved')$$, :'club', :'ana'), '42501', null,
  'cannot rejoin as approved directly');
select ok(jsonb_array_length(public.export_my_data() -> 'clubs') = 1, 'club memberships are in the data export');
select tests.clear_authentication();
select ok(exists (select 1 from audit.log where table_name = 'club_members' and action = 'update' and after ->> 'status' = 'approved' and subject_alias is not null),
  'approvals are audit-logged with the member as an alias');

select * from finish();
rollback;
