begin;
\ir _helpers.psql
select plan(34);

select tests.create_user('priv18@runlime.test') as priv \gset
select tests.create_user('pub18@runlime.test') as pub \gset
select tests.create_user('fan18@runlime.test') as fan \gset
select tests.create_user('admin18@runlime.test') as admin \gset
insert into public.user_roles values (:'admin', 'platform_admin');
select is((select account_privacy::text from public.profiles where id = :'fan'), 'private', 'new accounts are Private by default');
update public.profiles set account_privacy = 'public' where id = :'pub';
update public.profiles set nickname = 'Priv Runner' where id = :'priv';

\set ev '{"name":"Follow Test 5K","starts_at":"2031-06-01T06:00:00-04:00","venue_name":"Savannah","start_lat":10.67,"start_lng":-61.51,"registration_url":"https://example.org/r"}'
select tests.authenticate_as(:'admin', 'aal2');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('listing_source', 'runlime', 'region_id', tests.area_id('Central')), '[{"km":5,"label":"5K"}]') as race \gset
select public.review_event(:'race', 'published');
select tests.authenticate_as(:'priv');
select public.set_rsvp(:'race', 'going', 1, 0);

-- ---------- Private by default: requests need approval ----------
select tests.authenticate_as(:'fan');
select is(public.follow_user(:'priv')::text, 'pending', 'following a private account sends a request');
select is((public.profile_card(:'priv') ->> 'can_see_details')::boolean, false, 'a pending request does not show the passport');
select throws_ok(format($$select public.profile_passport(%L)$$, :'priv'), '42501', null, 'private passport refused before approval');
select is(public.follow_user(:'pub')::text, 'accepted', 'following a public account is instant');
select is(((public.profile_passport(:'pub')) ->> 'races_attended')::int, 0, 'public passport visible to anyone signed in');
select throws_ok(format($$select public.follow_user(%L)$$, :'fan'), '22023', null, 'cannot follow yourself');
select throws_ok(format($$insert into public.follows values (%L, %L, 'accepted', now(), now())$$, :'fan', :'priv'), '42501', null,
  'follows only through follow_user (no self-approval)');

select tests.authenticate_as(:'priv');
select is(jsonb_array_length(public.my_connections() -> 'requests'), 1, 'the private runner sees the request');
select lives_ok(format($$select public.respond_follow_request(%L, true)$$, :'fan'), 'and approves it');
select tests.authenticate_as(:'fan');
select is((public.profile_card(:'priv') ->> 'can_see_details')::boolean, true, 'approved followers see details');
select is(jsonb_array_length(public.profile_passport(:'priv') -> 'attending'), 1, 'followers see races the person is attending');
select is((public.profile_card(:'priv') ->> 'followers')::int, 1, 'follower count');
select is((select display_name from public.following_going(:'race')), 'priv18', 'the race page shows people you follow who are going');
select tests.authenticate_as(:'pub');
select is((select count(*)::int from public.following_going(:'race')), 0, 'people who do not follow them see no names');
select tests.authenticate_as(:'fan');
select ok(public.profile_card(:'priv') ? 'display_name' and not (public.profile_card(:'priv') ? 'date_of_birth') and not (public.profile_card(:'priv') ? 'home_region_id'),
  'profile cards never include DOB or home area');
select is((select count(*)::int from public.profiles), 1, 'other profiles are still not readable directly (only through safe functions)');

-- ---------- Search ----------
select is((select count(*)::int from public.search_people('p')), 0, 'search needs 2+ characters (setting)');
select is((select display_name from public.search_people('Priv Run')), 'priv18', 'search by nickname');

-- ---------- Remove follower, decline ----------
select tests.authenticate_as(:'priv');
select lives_ok(format($$select public.remove_follower(%L)$$, :'fan'), 'remove a follower');
select tests.authenticate_as(:'fan');
select is((public.profile_card(:'priv') ->> 'following'), null, 'no longer following');
select public.follow_user(:'priv');
select tests.authenticate_as(:'priv');
select lives_ok(format($$select public.respond_follow_request(%L, false)$$, :'fan'), 'decline a request');
select throws_ok(format($$select public.respond_follow_request(%L, true)$$, :'fan'), 'P0002', null, 'a declined request is gone');

-- ---------- Switching to Public approves waiting requests ----------
select tests.authenticate_as(:'fan');
select public.follow_user(:'priv');
select tests.authenticate_as(:'priv');
update public.profiles set account_privacy = 'public' where id = :'priv';
select is((select status::text from public.follows where follower_id = :'fan' and followee_id = :'priv'), 'accepted', 'going Public approves waiting requests');
update public.profiles set account_privacy = 'private' where id = :'priv';

-- ---------- Block ----------
select lives_ok(format($$select public.block_user(%L)$$, :'fan'), 'block');
select is((select count(*)::int from public.follows where (follower_id = :'fan' and followee_id = :'priv') or (follower_id = :'priv' and followee_id = :'fan')), 0,
  'blocking removes follows both ways');
select tests.authenticate_as(:'fan');
select throws_ok(format($$select public.follow_user(%L)$$, :'priv'), 'P0002', null, 'a blocked person cannot follow or request');
select throws_ok(format($$select public.profile_card(%L)$$, :'priv'), 'P0002', null, 'or see the profile');
select is((select count(*)::int from public.search_people('Priv Run')), 0, 'or find them in search');
select tests.authenticate_as(:'priv');
select is((select count(*)::int from public.search_people('fan18')), 0, 'and the blocker no longer sees them either');
select is(jsonb_array_length(public.my_connections() -> 'blocked'), 1, 'blocked list');
select lives_ok(format($$select public.unblock_user(%L)$$, :'fan'), 'unblock');
select tests.authenticate_as(:'fan');
select is(public.follow_user(:'priv')::text, 'pending', 'after unblocking they can request again');

-- ---------- Export ----------
select ok(jsonb_array_length(public.export_my_data() -> 'following') = 2, 'who you follow is in the data export');

select * from finish();
rollback;
