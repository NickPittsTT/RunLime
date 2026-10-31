// Row counts per table (public, auth, storage, audit), one "schema.table count" line each, sorted. Used by the backup
// restore test to compare the live project with the restored copy. Prints counts only, never data.
//   remote: SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF (Management API)   local: DB_URL (psql)
import { execFileSync } from 'node:child_process';

const QUERY = `select table_schema || '.' || table_name || ' ' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text as line
  from information_schema.tables
  where table_schema in ('public', 'auth', 'storage', 'audit') and table_type = 'BASE TABLE'
    and table_name not in ('schema_migrations', 'migrations')  -- Supabase's own version bookkeeping (differs by version)
  order by 1`;

const mode = process.argv[2];
let lines;
if (mode === 'remote') {
  const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref } = process.env;
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ query: QUERY }),
  });
  if (!res.ok) throw new Error(`row counts: HTTP ${res.status}`);
  lines = (await res.json()).map((r) => r.line);
} else if (mode === 'local') {
  lines = execFileSync('psql', [process.env.DB_URL, '-X', '-q', '-t', '-A', '-c', QUERY], { encoding: 'utf8' }).split('\n').filter(Boolean);
} else {
  throw new Error('usage: remote | local');
}
console.log(lines.sort().join('\n'));
