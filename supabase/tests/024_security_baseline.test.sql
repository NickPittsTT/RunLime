-- Security baseline (owner, 2026-10-24). Fails when anything exposed through the API gets more access than intended.
-- The allowlists below are the intended state: changing them is a deliberate, reviewed decision, never a side effect
-- of a migration (new tables/functions start with no anon/authenticated access).
begin;
\ir _helpers.psql
select plan(12);

-- ---------- Row security everywhere the API can reach ----------
select is(
  (select array_agg(n.nspname || '.' || c.relname order by n.nspname, c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'graphql_public') and c.relkind in ('r', 'p') and not c.relrowsecurity),
  null, 'every table in an exposed schema has row level security on');
select is(
  (select array_agg(n.nspname || '.' || c.relname order by n.nspname, c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'graphql_public') and c.relkind in ('v', 'm')
      and not coalesce('security_invoker=true' = any (c.reloptions), false)),
  null, 'every view in an exposed schema runs with the caller''s rights (no SECURITY DEFINER views)');

-- ---------- Table privileges ----------
select is(
  (select array_agg(table_name || ':' || privs order by table_name) from (
     select table_name, string_agg(privilege_type, ',' order by privilege_type) privs
       from information_schema.role_table_grants where grantee = 'anon' and table_schema in ('public', 'graphql_public') group by table_name) t),
  array['app_settings:SELECT', 'clubs:SELECT', 'countries:SELECT', 'event_changes:SELECT', 'event_distances:SELECT', 'event_media:SELECT',
        'event_sponsors:SELECT', 'events:SELECT', 'legal_documents:SELECT', 'regions:SELECT'],
  'anon (signed out) can only read the public tables, never write');
select is(
  (select array_agg(table_name || ':' || privs order by table_name) from (
     select table_name, string_agg(privilege_type, ',' order by privilege_type) privs
       from information_schema.role_table_grants where grantee = 'authenticated' and table_schema in ('public', 'graphql_public')
        and privilege_type <> 'SELECT' group by table_name) t),
  array['app_settings:UPDATE', 'club_members:DELETE', 'clubs:INSERT', 'event_media:DELETE,INSERT', 'event_sponsors:DELETE,INSERT',
        'notification_settings:INSERT,UPDATE', 'notifications:DELETE', 'profile_private:DELETE,INSERT,UPDATE', 'rsvps:DELETE',
        'user_preferences:DELETE,INSERT,UPDATE'],
  'signed-in users write directly only where a policy allows it (everything else goes through checked functions)');
select is(
  (select array_agg(distinct privilege_type::text) from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated') and table_schema in ('public', 'graphql_public') and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')),
  null, 'no TRUNCATE/REFERENCES/TRIGGER for app roles (TRUNCATE ignores row security)');

-- ---------- Policies ----------
select is(
  (select array_agg(tablename || '.' || policyname order by tablename, policyname) from pg_policies
    where schemaname = 'public' and cmd <> 'SELECT' and (roles && array['anon', 'public']::name[])),
  null, 'no write policy applies to signed-out visitors');
select is(
  (select array_agg(tablename || '.' || policyname order by tablename, policyname) from pg_policies
    where schemaname = 'public' and cmd <> 'SELECT'
      and (btrim(coalesce(qual, '')) = 'true' or btrim(coalesce(with_check, '')) = 'true')),
  null, 'no write policy is always true');

-- ---------- Functions ----------
select is(
  (select array_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c = 'search_path=""' or c = 'search_path=')),
  null, 'every SECURITY DEFINER function pins search_path to empty');
select is(
  (select array_agg(distinct p.proname::text order by p.proname::text) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  array['club_turnout', 'has_profile', 'has_role', 'is_event_co_organiser', 'is_org_member', 'rsvp_counts'],
  'signed-out visitors can run only these privileged functions (public race-page counts; helpers used by public policies)');
select is(
  (select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  null, 'trigger functions are not callable through the API');

-- ---------- has_role answers only about the caller ----------
select tests.create_user('admin24@runlime.test') as admin \gset
select tests.create_user('ana24@runlime.test') as ana \gset
insert into public.user_roles values (:'admin', 'super_admin');
select tests.authenticate_as(:'ana');
select is(public.has_role('super_admin', :'admin'), false, 'a runner cannot find out who is an admin');
select tests.clear_authentication();
select is(public.has_role('super_admin', :'admin'), true, 'server code (no user token) still can');

select * from finish();
rollback;
