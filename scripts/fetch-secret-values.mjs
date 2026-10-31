// Writes the staging project's secret Supabase keys (legacy service_role JWT and every sb_secret_ key) to a temp
// file as "name<TAB>value" for the build secret scan's exact-value check. Values are masked in GitHub logs and never
// printed; only names are listed. Read-only (Management API).
//   SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF node scripts/fetch-secret-values.mjs <out-file>
import { writeFileSync } from 'node:fs';

const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref } = process.env;
const out = process.argv[2];
if (!token || !ref || !out) throw new Error('SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF and an output file are required');
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers: { authorization: `Bearer ${token}` } });
if (!res.ok) throw new Error(`could not read the project's keys (HTTP ${res.status}); the scan can't prove the build is free of them`);
const secret = (await res.json()).filter((k) => k.type === 'secret' || (k.type === 'legacy' && k.name === 'service_role')).filter((k) => typeof k.api_key === 'string' && k.api_key.length >= 20);
for (const k of secret) console.log(`::add-mask::${k.api_key}`);
writeFileSync(out, secret.map((k) => `${k.name}\t${k.api_key}`).join('\n') + '\n', { mode: 0o600 });
console.log(`Checking the build against ${secret.length} secret key(s) by value: ${secret.map((k) => `${k.name} (${k.type})`).join(', ') || 'none'}`);
