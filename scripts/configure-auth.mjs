// Configure hosted Supabase Auth for a RunLime environment via the Management API, then verify.
// Runs ONLY in GitHub Actions (needs SUPABASE_ACCESS_TOKEN). Prints setting names and non-secret values only.
//
//   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… SUPABASE_ANON_KEY=… node scripts/configure-auth.mjs [--apply]
import { readFileSync } from 'node:fs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const anonKey = process.env.SUPABASE_ANON_KEY;
const apply = process.argv.includes('--apply');
if (!token || !ref) throw new Error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required');

const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const SECRETISH = /(secret|password|pass|key|token|smtp_user|_jwk)/i;
const otpTemplate = readFileSync(new URL('../supabase/templates/otp.html', import.meta.url), 'utf8');

const desired = {
  disable_signup: false,
  external_email_enabled: true,
  external_phone_enabled: false,
  external_anonymous_users_enabled: false,
  mailer_otp_exp: 600,
  mailer_otp_length: 6,
  mailer_subjects_magic_link: 'Your RunLime sign-in code',
  mailer_templates_magic_link_content: otpTemplate,
  mailer_subjects_confirmation: 'Your RunLime sign-in code',
  mailer_templates_confirmation_content: otpTemplate,
  uri_allow_list: 'runlime://auth/callback',
  hook_before_user_created_enabled: true,
  hook_before_user_created_uri: 'pg-functions://postgres/public/hook_before_user_created',
  hook_custom_access_token_enabled: true,
  hook_custom_access_token_uri: 'pg-functions://postgres/public/custom_access_token_hook',
  mfa_totp_enroll_enabled: true,
  mfa_totp_verify_enabled: true,
  mfa_phone_enroll_enabled: false,
  mfa_phone_verify_enabled: false,
};

const show = (k, v) => (SECRETISH.test(k) ? '(hidden)' : typeof v === 'string' && v.length > 60 ? `${v.slice(0, 57)}…` : JSON.stringify(v));

async function getConfig() {
  const res = await fetch(api, { headers });
  if (!res.ok) throw new Error(`GET auth config failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function report(title, cfg) {
  console.log(`\n== ${title}`);
  for (const k of Object.keys(desired)) {
    const ok = k in cfg ? (cfg[k] === desired[k] ? 'OK  ' : 'DIFF') : 'N/A ';
    console.log(`${ok} ${k} = ${k in cfg ? show(k, cfg[k]) : '(not in this plan/API)'}`);
  }
}

const before = await getConfig();
report('Current staging auth config', before);
const unsupported = Object.keys(desired).filter((k) => !(k in before));
const body = Object.fromEntries(Object.entries(desired).filter(([k]) => k in before));

let failed = false;
if (apply) {
  const res = await fetch(api, { method: 'PATCH', headers, body: JSON.stringify(body) });
  const text = await res.text();
  console.log(`\nPATCH → HTTP ${res.status}${res.ok ? '' : `: ${text.slice(0, 500)}`}`);
  if (!res.ok) failed = true;
  const after = await getConfig();
  report('After update', after);
  const mismatched = Object.keys(body).filter((k) => after[k] !== desired[k]);
  if (mismatched.length) {
    console.log(`\nNOT APPLIED (possibly a paid-plan restriction): ${mismatched.join(', ')}`);
    failed = true;
  }
}
if (unsupported.length) console.log(`\nFields not offered by this project's API: ${unsupported.join(', ')}`);

// Functional probe of the Before User Created hook: under-18 / missing DOB must be rejected (no user is created, no email sent).
if (anonKey) {
  const probe = async (label, data) => {
    const res = await fetch(`https://${ref}.supabase.co/auth/v1/otp`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email: `age-gate-probe-${Date.now()}@example.invalid`, create_user: true, ...(data ? { data } : {}) }),
    });
    const t = await res.text();
    const pass = res.status === 403 && /18 and over/.test(t);
    console.log(`${pass ? 'PASS' : 'FAIL'} hook probe (${label}): HTTP ${res.status} ${t.slice(0, 120)}`);
    if (!pass) failed = true;
  };
  console.log('\n== Before User Created hook probes (expect HTTP 403, nothing stored)');
  await probe('no date of birth', null);
  await probe('17-year-old', { date_of_birth: `${new Date().getUTCFullYear() - 17}-01-01` });
}

process.exit(failed ? 1 : 0);
