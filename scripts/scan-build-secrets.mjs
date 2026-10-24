// Scans a build output (web bundle directory) or an APK for secrets. Fails when it finds:
//  - a JWT whose role is service_role / supabase_admin (an anon JWT is public by design and allowed)
//  - a Supabase secret key (sb_secret_…), a private key block, a Google service-account key, common cloud/API tokens
//  - the exact value of any secret passed in the environment (names listed below) — reported by NAME, never printed
// Usage: node scripts/scan-build-secrets.mjs <dir | file.apk> [more …]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

// Secrets that must never be in anything shipped to users. Only those set in the environment are checked.
const SECRET_ENV = ['SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY', 'SUPABASE_DB_PASSWORD', 'SUPABASE_ACCESS_TOKEN', 'CLOUDFLARE_API_TOKEN', 'EXPO_TOKEN', 'SMTP_PASSWORD', 'PUSH_DISPATCH_SECRET', 'ADMIN_ALERTS_SECRET', 'EMERGENCY_CONTACT_KEY_V1', 'EMERGENCY_CONTACT_KEY_V2', 'FCM_SERVICE_ACCOUNT_JSON'];
const exact = SECRET_ENV.map((name) => [name, process.env[name]]).filter(([, v]) => typeof v === 'string' && v.length >= 8);

const PATTERNS = [
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{16,}/],
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ['Google service-account key', /"type"\s*:\s*"service_account"[\s\S]{0,2000}"private_key"/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ['Stripe live secret', /\bsk_live_[A-Za-z0-9]{20,}\b/],
  ['Expo access token', /\bexpo_[A-Za-z0-9_-]{30,}\b/],
];
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
const FORBIDDEN_ROLES = new Set(['service_role', 'supabase_admin', 'postgres']);

function files(path) {
  const st = statSync(path);
  if (st.isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((e) => (e.name === 'node_modules' ? [] : files(join(path, e.name))));
}

const findings = [];
let scanned = 0;
for (const target of process.argv.slice(2)) {
  let root = target;
  if (target.endsWith('.apk') || target.endsWith('.aab')) {
    root = mkdtempSync(join(tmpdir(), 'apk-'));
    execFileSync('unzip', ['-q', '-o', target, '-d', root]);
  }
  for (const f of files(root)) {
    const st = statSync(f);
    if (st.size > 50 * 1024 * 1024) continue;
    const text = readFileSync(f).toString('latin1');
    scanned++;
    const where = root === target ? (relative(root, f) ? join(target, relative(root, f)) : f) : `${target}:${relative(root, f)}`;
    for (const [name, re] of PATTERNS) if (re.test(text)) findings.push(`${name} in ${where}`);
    for (const m of text.matchAll(JWT)) {
      try {
        const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
        if (FORBIDDEN_ROLES.has(payload.role)) findings.push(`JWT with role "${payload.role}" in ${where}`);
      } catch {
        // not a JWT payload
      }
    }
    for (const [name, value] of exact) if (text.includes(value)) findings.push(`the value of ${name} in ${where}`);
  }
}

console.log(`Scanned ${scanned} files; checked ${PATTERNS.length + 1} patterns and ${exact.length} secret value(s) by name: ${exact.map(([n]) => n).join(', ') || 'none set'}`);
if (scanned === 0) {
  console.log('::error::Nothing was scanned (wrong path?)');
  process.exit(1);
}
if (findings.length) {
  for (const f of [...new Set(findings)]) console.log(`::error::Secret in build output: ${f}`);
  process.exit(1);
}
console.log('No secrets found in the build output.');
