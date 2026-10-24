// Supabase Security Advisor on a hosted project (Management API), after a deploy or on demand. Fails on any ERROR.
// Prints lint names and object names only (no data).   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node scripts/hosted-advisor.mjs
const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref } = process.env;
if (!token || !ref) throw new Error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required');
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/advisors/security`, { headers: { authorization: `Bearer ${token}` } });
const body = await res.json().catch(() => null);
if (!res.ok) {
  console.log(`::error::Security Advisor API returned HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  process.exit(1);
}
const lints = Array.isArray(body) ? body : (body?.lints ?? []);
const counts = new Map();
for (const l of lints) counts.set(`${l.level} ${l.name}`, (counts.get(`${l.level} ${l.name}`) ?? 0) + 1);
console.log(`Hosted Security Advisor (${ref}): ${lints.length} findings`);
for (const [k, n] of [...counts].sort()) console.log(`  ${k}: ${n}`);
const errors = lints.filter((l) => l.level === 'ERROR');
for (const l of errors) console.log(`::error::${l.name}: ${l.detail}`);
if (errors.length) process.exit(1);
console.log('No ERROR-level findings.');
