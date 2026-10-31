// Self-test for the build secret scan (run in CI). Uses fake values only.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scan = (content, env = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-'));
  writeFileSync(join(dir, 'bundle.js'), content);
  try {
    execFileSync('node', ['scripts/scan-build-secrets.mjs', dir], { env: { PATH: process.env.PATH, ...env }, stdio: 'pipe' });
    return 'clean';
  } catch (e) {
    return String(e.stdout) + String(e.stderr);
  }
};
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeKey = 'sb_secret_' + 'Q7xKp2Lm9VtR4wZb8NcYd3Hj6Fg1SaEu'; // fake, random-looking
const cases = [
  ['the 31 Oct false positive (supabase-js check + packed library strings) is clean', "x'sb_secret_'_disposeResourcescreenEdgeGestureadUint16LExpoFontLoadergb(39, 39, 41)", {}, (r) => r === 'clean'],
  ['a random-looking sb_secret_ key fails', `const k="${fakeKey}";`, {}, (r) => /Supabase secret key/.test(r)],
  ['the exact value of a real project key fails, reported by name only', 'abc1234567890tokenvalue', { SECRET_VALUES_FILE: (() => { const f = join(mkdtempSync(join(tmpdir(), 'v-')), 'v'); writeFileSync(f, 'default\tabc1234567890tokenvalue\n'); return f; })() }, (r) => /Supabase key "default"/.test(r) && !r.includes('abc1234567890tokenvalue')],
  ['a service_role JWT fails', `${b64({ alg: 'HS256' })}.${b64({ role: 'service_role', iss: 'supabase' })}.c2lnbmF0dXJlLXZhbHVl`.replace(/^/, 'eyJ').replace('eyJey', 'ey'), {}, (r) => /role "service_role"/.test(r)],
  ['an anon JWT is allowed', `${b64({ alg: 'HS256' })}.${b64({ role: 'anon', iss: 'supabase' })}.c2lnbmF0dXJlLXZhbHVl`, {}, (r) => r === 'clean'],
];
let failed = 0;
for (const [name, content, env, ok] of cases) {
  const r = scan(content, env);
  const pass = ok(r);
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `\n      got: ${r.slice(0, 300)}`}`);
}
process.exit(failed ? 1 : 0);
