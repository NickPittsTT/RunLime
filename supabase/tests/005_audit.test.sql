-- F3: audit log keeps no personal data and cannot be linked to deleted users.
begin;
\ir _helpers.psql
select plan(9);

select tests.create_user('owner@runlime.test') as owner \gset
select tests.create_user('admin@runlime.test') as admin \gset
insert into public.user_roles values (:'admin', 'platform_admin');

select tests.authenticate_as(:'owner');
select public.apply_as_organiser('Chaguaramas Runners', 'secret-contact@runners.tt', '868-555-0199', '', 'Boardwalk runs every month in Chaguaramas.', false) as org \gset
select tests.authenticate_as(:'admin', 'aal2');
select public.review_organisation(:'org', 'verified');
select tests.clear_authentication();

select ok(exists (select 1 from audit.log where table_name = 'organisations' and row_id = :'org' and action = 'update'
                  and after ->> 'status' = 'verified'), 'verification is audited');
select ok(not exists (select 1 from audit.log where (coalesce(before::text, '') || coalesce(after::text, '')) ~ '(secret-contact|868-555-0199)'),
  'organisation contact details are never written to the audit log');
select ok(not exists (select 1 from audit.log where (coalesce(before::text, '') || coalesce(after::text, '')) ~ '(date_of_birth|display_name|email)'),
  'no personal field names appear in audit values');
select is((select actor_alias from audit.log where table_name = 'organisations' and action = 'update' order by id desc limit 1),
  (select alias from audit.actor_aliases where user_id = :'admin'), 'actor recorded as alias');
select ok(not exists (select 1 from audit.log where actor_alias = :'admin'::uuid or subject_alias = :'owner'::uuid or row_id in (:'admin', :'owner')),
  'raw user ids are never stored');

-- delete the owner: the alias disappears, entries remain but are unlinkable
select alias as owner_alias from audit.actor_aliases where user_id = :'owner' \gset
delete from auth.users where id = :'owner';
select is((select count(*)::int from audit.actor_aliases where user_id = :'owner'), 0, 'alias mapping removed with the account');
select ok(exists (select 1 from audit.log where actor_alias = :'owner_alias'), 'history kept under the now-unlinkable alias');

-- append-only, even for the table owner
select throws_ok($$update audit.log set after = '{}'$$, '42501', null, 'audit log cannot be updated');
select throws_ok($$delete from audit.log$$, '42501', null, 'audit log cannot be deleted');

select * from finish();
rollback;
