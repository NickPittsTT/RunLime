// Read-only: confirms the security hardening is live on a hosted project (Management API SQL). Prints names only.
//   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node scripts/staging-security-check.mjs
const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref } = process.env;
if (!token || !ref) throw new Error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required');
async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}
const checks = [
  ['migration 20261024000100 applied', `select count(*)::int = 1 as ok from supabase_migrations.schema_migrations where version = '20261024000100'`],
  ["club_member_counts runs with the caller's rights", `select coalesce('security_invoker=true' = any (reloptions), false) as ok from pg_class where oid = 'public.club_member_counts'::regclass`],
  ['anon can only read (no write/TRUNCATE on any public table)', `select not exists (select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and privilege_type <> 'SELECT') as ok`],
  ['no TRUNCATE/REFERENCES/TRIGGER for app roles', `select not exists (select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema = 'public' and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')) as ok`],
  ['has_role answers only about the caller', `select position('auth.role()' in pg_get_functiondef('public.has_role'::regproc)) > 0 as ok`],
  ['setting_int not callable by anon/authenticated', `select not has_function_privilege('anon', 'public.setting_int(text, integer)', 'execute') and not has_function_privilege('authenticated', 'public.setting_int(text, integer)', 'execute') as ok`],
  ['trigger functions not callable by app roles', `select not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prorettype = 'trigger'::regtype and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))) as ok`],
  ['retest round 3 migrations applied (20261030000100, 20261030000200)', `select count(*)::int = 2 as ok from supabase_migrations.schema_migrations where version in ('20261030000100', '20261030000200')`],
  ['push tokens tied to sign-in sessions; targets only for live sessions', `select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'push_tokens' and column_name = 'session_id') and not has_function_privilege('authenticated', 'public.push_targets(uuid[])', 'execute') as ok`],
  ['message limits 3 per 7 days / 10 in race week', `select (select value from public.app_settings where key = 'messages.per_race_per_week') = '3' and (select value from public.app_settings where key = 'messages.race_week_limit') = '10' as ok`],
  ['private photos: visible_avatar used by people lists, not callable by apps', `select bool_and(position('visible_avatar' in pg_get_functiondef(p.oid)) > 0) and not has_function_privilege('authenticated', 'public.visible_avatar(uuid, text)', 'execute') as ok from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('club_page', 'following_going', 'my_connections', 'profile_card', 'search_people')`],
  ['row security on every public table', `select not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity) as ok`],
];
let failed = 0;
for (const [name, q] of checks) {
  const [row] = await sql(q);
  const ok = row?.ok === true;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
console.log(failed ? `${failed} check(s) failed` : `All ${checks.length} checks passed on ${ref}.`);
process.exit(failed ? 1 : 0);
