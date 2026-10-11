-- Every table in exposed schemas must have RLS enabled.
begin;
\ir _helpers.psql
select plan(2);
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null, 'all public tables have row level security enabled');
select ok(not has_schema_privilege('authenticated', 'audit', 'usage'), 'audit schema is not exposed to app roles');
select * from finish();
rollback;
