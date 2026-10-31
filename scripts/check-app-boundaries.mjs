// CI check (incident review 31 Oct 2026): nothing that holds or uses server credentials can reach the mobile app.
// - app code never reads a non-public environment variable, a service key, or anything under scripts/ or e2e/
// - test-account tooling (scripts/ui-check-account.mjs) and the service key are never part of an app build workflow
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return n === 'node_modules' || n.startsWith('.') ? [] : statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(n) ? [p] : [];
});
const problems = [];
const appFiles = [...walk('apps/mobile/app'), ...walk('apps/mobile/src')];
for (const f of appFiles) {
  const t = readFileSync(f, 'utf8');
  if (/SERVICE_ROLE|service_role|sb_secret_|SUPABASE_SECRET/.test(t)) problems.push(`${f}: mentions a service key`);
  for (const m of t.matchAll(/process\.env\.([A-Z0-9_]+)/g)) if (!/^(EXPO_PUBLIC_|NODE_ENV$)/.test(m[1])) problems.push(`${f}: reads non-public env ${m[1]}`);
  if (/from ['"](\.\.\/)+(scripts|e2e)\//.test(t)) problems.push(`${f}: imports from scripts/ or e2e/`);
}
const config = readFileSync('apps/mobile/app.config.ts', 'utf8');
const extra = config.slice(config.indexOf('extra:'));
for (const m of extra.matchAll(/process\.env\.([A-Z0-9_]+)/g)) if (!m[1].startsWith('EXPO_PUBLIC_')) problems.push(`app.config.ts extra: non-public env ${m[1]} would be compiled into the app`);
if (!/assertPublicEnv\(\)/.test(config)) problems.push('app.config.ts: the EXPO_PUBLIC_ secret guard (assertPublicEnv) is missing');
for (const wf of ['mobile-dev-build.yml']) {
  const t = readFileSync(join('.github/workflows', wf), 'utf8');
  if (/SERVICE_ROLE|ui-check-account|sb_secret/.test(t)) problems.push(`${wf}: an app build workflow must not see the service key or test-account tooling`);
}
if (problems.length) {
  for (const p of problems) console.log(`FAIL  ${p}`);
  process.exit(1);
}
console.log(`PASS  ${appFiles.length} app files: no service keys, no non-public env, no scripts/e2e imports; build workflow has no server credentials`);
