// Read-only credentials audit (owner request, 31 Oct 2026). Prints names, types, dates and states only; never a
// key, token, password or variable value. Runs in GitHub Actions ("Staging diagnostics" → credentials-audit).
//   SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF [SUPABASE_SERVICE_ROLE_KEY] [EXPO_TOKEN] node scripts/credentials-audit.mjs
import { execFileSync } from 'node:child_process';

const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref, SUPABASE_SERVICE_ROLE_KEY: serviceKey, EXPO_TOKEN: expoToken } = process.env;
if (!token || !ref) throw new Error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required');
const section = (t) => console.log(`\n===== ${t} =====`);
const api = async (path) => {
  const res = await fetch(`https://api.supabase.com${path}`, { headers: { authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
};
const sql = async (query) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  });
  return res.ok ? res.json() : [];
};
// Describes a credential by its shape only.
function kind(v) {
  if (!v) return 'not set';
  if (v.startsWith('sb_secret_')) return 'new secret key (sb_secret_)';
  if (v.startsWith('sb_publishable_')) return 'new publishable key (public)';
  const p = v.split('.');
  if (p.length === 3 && v.startsWith('eyJ')) {
    try {
      return `legacy JWT, role "${JSON.parse(Buffer.from(p[1], 'base64url').toString()).role}"`;
    } catch {
      return 'JWT (unreadable payload)';
    }
  }
  return 'unrecognised format';
}

section('1. Supabase: organisation projects');
const projects = await api('/v1/projects');
if (!projects.ok) console.log(`  could not list projects (HTTP ${projects.status}; the token may be scoped to one project)`);
else for (const p of projects.body) console.log(`  ${p.name}  ref ${p.id}${p.id === ref ? ' (staging, this audit)' : ''}  region ${p.region}  status ${p.status}  created ${p.created_at}`);

section('2. Supabase staging: API keys (names, types, dates; no values)');
const keys = await api(`/v1/projects/${ref}/api-keys`);
if (!keys.ok) console.log(`  could not list keys (HTTP ${keys.status})`);
else for (const k of keys.body) {
  const created = k.inserted_at ?? k.created_at ?? '';
  console.log(`  ${String(k.name).padEnd(16)} type ${String(k.type ?? 'legacy').padEnd(12)} ${k.prefix ? `prefix ${k.prefix}  ` : ''}${created ? `created ${created}  ` : ''}${k.updated_at ? `updated ${k.updated_at}` : ''}${k.description ? `  "${k.description}"` : ''}`);
}

section('3. Which kind of key the GitHub secret SUPABASE_SERVICE_ROLE_KEY holds, and whether it still works');
console.log(`  kind: ${kind(serviceKey)}`);
if (serviceKey) {
  const res = await fetch(`https://${ref}.supabase.co/rest/v1/app_settings?select=key&limit=1`, { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } });
  console.log(`  REST read with it: HTTP ${res.status} (${res.ok ? 'works' : 'REFUSED'})`);
  const auth = await fetch(`https://${ref}.supabase.co/auth/v1/admin/users?per_page=1`, { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } });
  console.log(`  Auth admin read with it: HTTP ${auth.status} (${auth.ok ? 'works' : 'REFUSED'})`);
}

section('4. Edge Function secrets (names only) and functions');
const secrets = await api(`/v1/projects/${ref}/secrets`);
if (!secrets.ok) console.log(`  could not list (HTTP ${secrets.status})`);
else console.log(`  ${secrets.body.map((s) => s.name).sort().join(', ')}`);
const fns = await api(`/v1/projects/${ref}/functions`);
if (fns.ok) for (const f of fns.body) console.log(`  function ${String(f.slug).padEnd(24)} status ${f.status}  verify_jwt ${f.verify_jwt}  updated ${new Date(f.updated_at).toISOString()}`);

section('5. Vault secrets used by the database (names only)');
for (const r of await sql(`select name, created_at, updated_at from vault.secrets order by name`)) console.log(`  ${r.name}  created ${r.created_at}  updated ${r.updated_at}`);

section('6. Storage buckets');
for (const b of await sql(`select id, public, file_size_limit, allowed_mime_types, created_at from storage.buckets order by id`)) console.log(`  ${b.id.padEnd(14)} ${b.public ? 'PUBLIC' : 'private'}  limit ${b.file_size_limit ?? '-'}  types ${b.allowed_mime_types ?? '-'}  created ${b.created_at}`);

section('7. Auth settings (non-secret fields only)');
const auth = await api(`/v1/projects/${ref}/config/auth`);
if (!auth.ok) console.log(`  could not read (HTTP ${auth.status})`);
else {
  const a = auth.body;
  const providers = Object.keys(a).filter((k) => /^external_[a-z_]+_enabled$/.test(k) && a[k]).map((k) => k.replace(/^external_|_enabled$/g, ''));
  console.log(`  sign-up enabled: ${!a.disable_signup}; email provider: ${a.external_email_enabled}; providers on: ${providers.join(', ') || 'none'}`);
  console.log(`  site URL: ${a.site_url}; redirect allow list: ${a.uri_allow_list || '(none)'}`);
  console.log(`  MFA TOTP enroll/verify: ${a.mfa_totp_enroll_enabled}/${a.mfa_totp_verify_enabled}; max MFA factors: ${a.mfa_max_enrolled_factors}`);
  console.log(`  SMTP: host ${a.smtp_host || '(Supabase default mailer)'}; sender ${a.smtp_admin_email ? a.smtp_admin_email.replace(/^[^@]+/, '…') : '-'} (name "${a.smtp_sender_name ?? ''}"); emails per hour ${a.rate_limit_email_sent}`);
  console.log(`  hooks: before-user-created ${a.hook_before_user_created_enabled ?? '-'}; custom access token ${a.hook_custom_access_token_enabled ?? '-'}; leaked-password protection ${a.password_hibp_enabled ?? '-'}`);
}

section('8. Expo (EAS): environment variables (names, environments, visibility, dates; no values)');
const eas = (args) => execFileSync('npx', ['--yes', 'eas-cli@24.12.1', ...args], { cwd: 'apps/mobile', encoding: 'utf8', env: { ...process.env, EXPO_TOKEN: expoToken }, stdio: ['ignore', 'pipe', 'ignore'] });
if (!expoToken) console.log('  EXPO_TOKEN not available');
else {
  // The CLI prints "Field  value" blocks; only names, visibility, environments and dates are printed here. Each value
  // is only classified (public setting / kind of key / LOOKS SECRET), never shown.
  for (const scope of ['project', 'account']) {
    for (const env of ['development', 'preview', 'production']) {
      let out;
      try {
        out = eas(['env:list', env, '--format', 'long', '--scope', scope]);
      } catch (e) {
        console.log(`  [${scope}/${env}] could not list (${String(e.message).split('\n')[0].slice(0, 100)})`);
        continue;
      }
      const blocks = out.split(/\n\s*\n|—{3,}|-{5,}/).map((b) => b.trim()).filter((b) => /Variable|Name/i.test(b));
      if (!blocks.length) console.log(`  [${scope}/${env}] none`);
      for (const b of blocks) {
        const field = (re) => b.match(re)?.[1]?.trim() ?? '';
        const name = field(/(?:Variable name|Name)\s*:?\s+(\S+)/i);
        const value = field(/Value\s*:?\s+(.+)/i);
        const visibility = field(/Visibility\s*:?\s+(.+)/i);
        const updated = field(/Updated at\s*:?\s+(.+)/i);
        const looksSecret = /sb_secret_|-----BEGIN|"private_key"/.test(value) || /service_role/.test(kind(value));
        const what = /\*{3,}|sensitive|secret/i.test(value) && !looksSecret ? 'value hidden by Expo' : /KEY/.test(name) ? kind(value) : 'public setting';
        console.log(`  [${scope}/${env}] ${name.padEnd(34)} visibility ${visibility || '-'}  updated ${updated || '-'}  value: ${what}${looksSecret ? '  ⚠ LOOKS SECRET' : ''}`);
      }
    }
  }
  section('9. Expo: recent Android builds');
  try {
    const builds = JSON.parse(eas(['build:list', '--platform', 'android', '--limit', '15', '--json', '--non-interactive']));
    for (const b of builds) console.log(`  ${b.id.slice(0, 8)}  ${String(b.status).padEnd(9)} profile ${b.buildProfile}  commit ${String(b.gitCommitHash ?? '').slice(0, 7)}  created ${b.createdAt}${b.id.startsWith('dc8e29ea') ? '  ← flagged 31 Oct (scanner false positive)' : ''}`);
  } catch (e) {
    console.log(`  could not list builds (${String(e.message).split('\n')[0].slice(0, 120)})`);
  }
  section('10. Expo: credentials (Android)');
  try {
    // Structure only: field names and value types, never values.
    const shape = (o, depth = 0) => (depth > 3 || o === null || typeof o !== 'object' ? typeof o : Array.isArray(o) ? `[${o.length} × ${o.length ? JSON.stringify(shape(o[0], depth + 1)) : '-'}]` : Object.fromEntries(Object.keys(o).map((k) => [k, shape(o[k], depth + 1)])));
    console.log(JSON.stringify(shape(JSON.parse(eas(['credentials:list', '--platform', 'android', '--json'])))).slice(0, 1500));
  } catch {
    console.log('  not listable from the CLI without an interactive session; check expo.dev → Credentials (FCM V1 key record, build keystore)');
  }
}
console.log('\nDone (read-only).');
