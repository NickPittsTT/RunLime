begin;
\ir _helpers.psql
select plan(25);

select tests.create_user('admin20@runlime.test') as admin \gset
select tests.create_user('ana20@runlime.test') as ana \gset
select tests.create_user('ben20@runlime.test') as ben \gset
select tests.create_user('cat20@runlime.test') as cat \gset
insert into public.user_roles values (:'admin', 'platform_admin');

\set ev '{"name":"Notify 5K","starts_at":"2031-08-01T06:00:00-04:00","venue_name":"Savannah","start_lat":10.67,"start_lng":-61.51,"registration_url":"https://example.org/r"}'
select tests.authenticate_as(:'admin', 'aal2');
select public.save_event(null, :'ev'::jsonb || jsonb_build_object('listing_source', 'runlime', 'region_id', tests.area_id('Central')), '[{"km":5,"label":"5K"}]') as race \gset
select public.review_event(:'race', 'published');

-- ---------- Followers ----------
select tests.authenticate_as(:'ben');
select public.follow_user(:'ana');
select tests.authenticate_as(:'ana');
select is((select title from public.notifications where kind = 'follow_request'), 'ben20 asked to follow you', 'follow request notifies the private account');
select public.respond_follow_request(:'ben', true);
select tests.authenticate_as(:'ben');
select is((select title from public.notifications where kind = 'follow_accepted'), 'ana20 approved your follow request', 'approval notifies the follower');
select is((select count(*)::int from public.notifications where user_id = :'ana'), 0, 'people only see their own notifications');

-- ---------- Race changes reach people going / maybe (and nobody else) ----------
select tests.authenticate_as(:'ana');
select public.set_rsvp(:'race', 'going', 1, 0);
select tests.authenticate_as(:'ben');
select public.set_rsvp(:'race', 'maybe', 1, 0);
select tests.authenticate_as(:'cat');
select public.set_rsvp(:'race', 'not_going', 1, 0);
select tests.authenticate_as(:'admin', 'aal2');
select public.change_event_status(:'race', 'postponed', 'Heavy rain forecast', '2031-08-15T06:30:00-04:00');
select tests.authenticate_as(:'ana');
select is((select title from public.notifications where kind = 'race_postponed'), 'Notify 5K is postponed to Fri 15 Aug 2031, 6:30 am',
  'postponed with the new date and time (event time zone)');
select is((select body from public.notifications where kind = 'race_postponed'), 'Heavy rain forecast', 'with the reason');
select is((select data ->> 'event_id' from public.notifications where kind = 'race_postponed'), :'race', 'linked to the race');
select tests.authenticate_as(:'ben');
select is((select count(*)::int from public.notifications where kind = 'race_postponed'), 1, 'Maybe also hears about it');
select tests.authenticate_as(:'cat');
select is((select count(*)::int from public.notifications), 0, 'Not going hears nothing');
select tests.authenticate_as(:'admin', 'aal2');
select public.change_event_status(:'race', 'cancelled', 'Venue unavailable', null);
select public.change_event_status(:'race', 'published', '', null);
select tests.authenticate_as(:'ana');
select is((select count(*)::int from public.notifications where kind in ('race_cancelled', 'race_back_on')), 2, 'cancelled and back on are both sent');
select is((select title from public.notifications where kind = 'race_back_on'), 'Notify 5K is back on: Fri 01 Aug 2031, 6:00 am', 'back on with the original date');

-- ---------- Preferences ----------
insert into public.notification_settings (user_id, race_changes) values (:'ana', false);
select tests.authenticate_as(:'admin', 'aal2');
select public.change_event_status(:'race', 'postponed', 'Second postponement', null);
select tests.authenticate_as(:'ana');
select is((select count(*)::int from public.notifications where kind = 'race_postponed'), 1, 'turning off race changes stops them');
select throws_ok(format($$insert into public.notification_settings (user_id) values (%L)$$, :'ben'), '42501', null, 'cannot change someone else''s settings');
update public.notification_settings set race_changes = true where user_id = :'ana';
select tests.authenticate_as(:'admin', 'aal2');
select public.change_event_status(:'race', 'published', '', null);

-- ---------- Organiser messages: limit per race per 7 days (setting) ----------
select tests.authenticate_as(:'cat');
select throws_ok(format($$select public.send_event_message(%L, 'Bring water!')$$, :'race'), '42501', null, 'runners cannot message attendees');
select tests.authenticate_as(:'admin', 'aal2');
select throws_ok(format($$select public.send_event_message(%L, 'Hi')$$, :'race'), '22023', null, 'message needs 5+ characters');
select is(public.send_event_message(:'race', 'Race-pack collection moved to Friday 4–7 pm at the club.'), 2, 'sent to people going and maybe (2)');
select lives_ok(format($$select public.send_event_message(%L, 'Parking opens at 4:30 am.')$$, :'race'), 'second message this week');
select throws_ok(format($$select public.send_event_message(%L, 'One more thing')$$, :'race'), '22023', null, 'third message blocked (2 per race per week)');
select tests.authenticate_as(:'ana');
select is((select body from public.notifications where kind = 'organiser_message' order by created_at limit 1), 'Race-pack collection moved to Friday 4–7 pm at the club.', 'Ana got the message');
select tests.authenticate_as(:'cat');
select is((select count(*)::int from public.notifications where kind = 'organiser_message'), 0, 'Not going gets no messages');

-- ---------- Reminders ----------
select tests.clear_authentication();
update public.events set starts_at = now() + interval '24 hours' where id = :'race';
select ok(public.send_race_reminders() >= 2, 'reminders go to people going/maybe about a day before');
select is(public.send_race_reminders(), 0, 'and only once');

-- ---------- Read state, retention ----------
select tests.authenticate_as(:'ana');
select ok((select count(*) from public.notifications where read_at is null) > 0, 'new notifications are unread');
select public.mark_notifications_read();
select is((select count(*)::int from public.notifications where read_at is null), 0, 'mark all read');
select throws_ok(format($$update public.notifications set read_at = null where user_id = %L$$, :'ana'), '42501', null, 'notifications are not edited directly');
select tests.clear_authentication();
insert into public.notifications (user_id, kind, title, created_at) values (:'ana', 'new_follower', 'old one', now() - interval '91 days');
select ok(public.purge_old_notifications() >= 1, 'notifications older than 90 days are deleted');

select * from finish();
rollback;
