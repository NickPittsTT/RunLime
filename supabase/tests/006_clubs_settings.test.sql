begin;
\ir _helpers.psql
select plan(10);

select tests.create_user('admin@runlime.test') as admin \gset
select tests.create_user('runner@runlime.test') as runner \gset
insert into public.user_roles values (:'admin', 'platform_admin');

select tests.authenticate_as(:'runner');
select throws_ok($$insert into public.clubs (name) values ('Fake Club')$$, '42501', null, 'participants cannot create clubs');
select tests.authenticate_as(:'admin', 'aal1');
select throws_ok($$insert into public.clubs (name) values ('No MFA Club')$$, '42501', null, 'admins without MFA cannot create clubs');
select tests.authenticate_as(:'admin', 'aal2');
insert into public.clubs (name, description) values ('Trinidad Road Runners', 'Weekly long runs') returning id as club \gset
select ok(:'club' is not null, 'admin with MFA creates a club');

select tests.authenticate_as(:'runner');
select lives_ok(format($$select public.request_join_club(%L)$$, :'club'), 'runner asks to join the club (Phase 3: a leader approves)');
select throws_ok(format($$insert into public.club_members (club_id, user_id) values (%L, %L)$$, :'club', :'admin'), '42501', null, 'cannot add anyone directly');
select lives_ok(format($$delete from public.club_members where club_id = %L and user_id = %L$$, :'club', :'runner'), 'runner leaves');

-- settings
select tests.authenticate_anon();
select is((select value::int from public.app_settings where key = 'checkin.radius_m'), 500, 'public settings readable');
select is((select count(*)::int from public.app_settings where key = 'events.auto_publish_verified'), 0, 'private settings hidden from the public');
select tests.authenticate_as(:'runner');
update public.app_settings set value = '1' where key = 'checkin.radius_m';
select tests.authenticate_as(:'admin', 'aal2');
select is((select value::int from public.app_settings where key = 'checkin.radius_m'), 500, 'participants cannot change settings');
update public.app_settings set value = '400' where key = 'checkin.radius_m';
select is((select value::int from public.app_settings where key = 'checkin.radius_m'), 400, 'admins with MFA can change settings');

select * from finish();
rollback;
