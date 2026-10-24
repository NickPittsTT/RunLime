// Supabase Security Advisor (splinter) results → pass/fail. Fails on any ERROR-level lint.
// Input: psql unaligned output of splinter.sql with \x1f field and \x1e record separators (see ci.yml).
//   node scripts/security-advisor.mjs /tmp/advisor.out
import { readFileSync } from 'node:fs';

const COLS = ['name', 'title', 'level', 'facing', 'categories', 'description', 'detail', 'remediation', 'metadata', 'cache_key'];
const raw = readFileSync(process.argv[2], 'utf8');
const rows = raw
  .split('\x1e')
  .map((r) => r.replace(/^\n+|\n+$/g, ''))
  .filter((r) => r.includes('\x1f'))
  .map((r) => Object.fromEntries(r.split('\x1f').map((v, i) => [COLS[i], v])));
if (rows.some((r) => !r.level)) throw new Error('Unexpected Security Advisor output format');

const counts = new Map();
for (const r of rows) counts.set(`${r.level} ${r.name}`, (counts.get(`${r.level} ${r.name}`) ?? 0) + 1);
console.log(`Security Advisor: ${rows.length} findings`);
for (const [k, n] of [...counts].sort()) console.log(`  ${k}: ${n}`);

// Lints on the throwaway pgTAP helper schema don't ship (tests run in rolled-back transactions).
const relevant = rows.filter((r) => !/\btests\.[a-z_]+/.test(r.detail));
const errors = relevant.filter((r) => r.level === 'ERROR');
for (const r of relevant.filter((r) => r.level === 'WARN' && r.categories.includes('SECURITY') && !r.name.endsWith('_security_definer_function_executable'))) {
  console.log(`::warning::${r.name}: ${r.detail}`);
}
// SECURITY DEFINER functions callable by app roles are by design (RPC-only API, each checks its caller and has
// pgTAP tests); the anon-callable set is pinned in supabase/tests/024_security_baseline.test.sql.
if (errors.length) {
  for (const r of errors) console.log(`::error::${r.name}: ${r.detail} (${r.remediation})`);
  console.log(`${errors.length} ERROR-level finding(s): fix them (or record an owner-approved exception in docs/operations/SECURITY-PLAN.md).`);
  process.exit(1);
}
console.log('No ERROR-level findings.');
