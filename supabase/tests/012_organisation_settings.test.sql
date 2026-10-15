begin;
\ir _helpers.psql
select plan(8);

select tests.create_user('owner@runlime.test') as owner \gset
select tests.create_user('mate@runlime.test') as mate \gset
select tests.create_user('admin@runlime.test') as admin \gset
insert into public.user_roles values (:'admin', 'platform_admin');
select email as mate_email from auth.users where id = :'mate' \gset

select tests.authenticate_as(:'owner');
select public.apply_as_organiser('Arima Road Runners', 'run@arima.tt', '868-555-0101', '', 'Weekly long runs and the Arima Velodrome fun run.', false) as org \gset
select tests.authenticate_as(:'admin', 'aal2');
select public.review_organisation(:'org', 'verified');

select tests.authenticate_as(:'owner');
select throws_ok(format($$select public.update_organisation(%L, 'bad-email', '868', '', 'Weekly long runs and the Arima Velodrome fun run.')$$, :'org'),
  '22023', null, 'contact email is validated');
select lives_ok(format($$select public.update_organisation(%L, 'hello@arima.tt', '868-555-0199', 'https://arima.example', 'Weekly long runs and the Arima Velodrome fun run, since 2010.')$$, :'org'),
  'members edit organisation details');
select lives_ok(format($$select public.add_organisation_member(%L, %L)$$, :'org', :'mate_email'), 'owner adds a manager by email');
select ok(public.has_role('organiser', :'mate'), 'a manager of a verified organisation becomes an organiser');

select tests.authenticate_as(:'mate');
select throws_ok(format($$select public.add_organisation_member(%L, %L)$$, :'org', :'mate_email'), '42501', null, 'managers cannot add members');
select throws_ok(format($$select public.remove_organisation_member(%L, %L)$$, :'org', :'owner'), '42501', null, 'managers cannot remove the owner');

select tests.authenticate_as(:'owner');
select throws_ok(format($$select public.remove_organisation_member(%L, %L)$$, :'org', :'owner'), '22023', null, 'the last owner cannot be removed');
select public.remove_organisation_member(:'org', :'mate');
select ok(not public.has_role('organiser', :'mate'), 'removing the manager removes the organiser role');

select * from finish();
rollback;
