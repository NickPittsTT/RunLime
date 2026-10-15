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

// Custom SMTP diagnostics: host/port/sender only; the username and password are never printed, only checked.
function smtpReport(cfg) {
  const mask = (e) => (typeof e === 'string' && e.includes('@') ? e.replace(/^(.).*(@.*)$/, '$1…$2') : JSON.stringify(e ?? null));
  const pass = cfg.smtp_pass;
  console.log('\n== Custom SMTP (non-secret view)');
  console.log(`smtp_host = ${JSON.stringify(cfg.smtp_host ?? null)}`);
  console.log(`smtp_port = ${JSON.stringify(cfg.smtp_port ?? null)}`);
  console.log(`smtp_sender_name = ${JSON.stringify(cfg.smtp_sender_name ?? null)}`);
  console.log(`smtp_admin_email (From) = ${mask(cfg.smtp_admin_email)}`);
  console.log(`smtp_user set = ${Boolean(cfg.smtp_user)}; same as From = ${cfg.smtp_user ? String(cfg.smtp_user).trim().toLowerCase() === String(cfg.smtp_admin_email ?? '').trim().toLowerCase() : 'n/a'}`);
  console.log(`smtp_user has spaces = ${cfg.smtp_user ? /\s/.test(String(cfg.smtp_user)) : 'n/a'}`);
  console.log(`smtp_pass returned by API = ${pass ? 'yes' : 'no (write-only)'}${pass ? `; contains spaces = ${/\s/.test(String(pass))}` : ''}`);
  console.log(`smtp_max_frequency = ${JSON.stringify(cfg.smtp_max_frequency ?? null)}; rate_limit_email_sent = ${JSON.stringify(cfg.rate_limit_email_sent ?? null)}`);
}

const before = await getConfig();
report('Current staging auth config', before);
smtpReport(before);
const unsupported = Object.keys(desired).filter((k) => !(k in before));
const body = Object.fromEntries(Object.entries(desired).filter(([k]) => k in before));

let failed = false;
let after = before;
if (apply) {
  // Apply in independent groups so a plan restriction on one group (e.g. email templates) does not block the others.
  const groups = {
    hooks: /^hook_/,
    mfa: /^mfa_/,
    'sign-in settings': /^(disable_signup|external_|uri_allow_list|mailer_otp_)/,
    'email templates': /^mailer_(subjects|templates)_/,
  };
  for (const [name, re] of Object.entries(groups)) {
    const part = Object.fromEntries(Object.entries(body).filter(([k]) => re.test(k) && before[k] !== desired[k]));
    if (Object.keys(part).length === 0) {
      console.log(`\n[${name}] already as desired`);
      continue;
    }
    const res = await fetch(api, { method: 'PATCH', headers, body: JSON.stringify(part) });
    const text = await res.text();
    console.log(`\n[${name}] PATCH ${Object.keys(part).join(', ')} → HTTP ${res.status}${res.ok ? '' : `: ${text.slice(0, 300)}`}`);
    if (!res.ok) failed = true;
  }
  after = await getConfig();
  report('After update', after);
  const mismatched = Object.keys(body).filter((k) => after[k] !== desired[k]);
  if (mismatched.length) {
    console.log(`\nNOT APPLIED (possibly a paid-plan restriction): ${mismatched.join(', ')}`);
    failed = true;
  }
}
if (unsupported.length) console.log(`\nFields not offered by this project's API: ${unsupported.join(', ')}`);

// Functional probe of the Before User Created hook: under-18 / missing DOB must be rejected (no user is created, no email sent).
if (anonKey && after.hook_before_user_created_enabled !== true) {
  console.log('\nHook probe skipped: Before User Created hook is not enabled (a probe could create a real user).');
  failed = true;
} else if (anonKey) {
  const probe = async (label, data) => {
    const res = await fetch(`https://${ref}.supabase.co/auth/v1/otp`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email: `age-gate-probe-${Date.now()}@example.com`, create_user: true, ...(data ? { data } : {}) }),
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

// Optional delivery test: send a real sign-in code to an owner-chosen address (--test-email=…).
// Creates a profile-less auth user that the 1-hour purge removes; it can do nothing without completing the age gate.
const testEmail = process.argv.find((a) => a.startsWith('--test-email='))?.split('=')[1];
if (testEmail && anonKey) {
  const res = await fetch(`https://${ref}.supabase.co/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: testEmail, create_user: true, data: { date_of_birth: '1990-01-01' } }),
  });
  const t = await res.text();
  console.log(`\n== Delivery test to ${testEmail.replace(/^(.).*(@.*)$/, '$1…$2')}: HTTP ${res.status} ${res.ok ? '(accepted by the SMTP server — check the inbox for a 6-digit code)' : t.slice(0, 200)}`);
  if (!res.ok) failed = true;
}

// Optional: last mail-related Auth log errors (Management API logs endpoint), email addresses redacted.
if (process.argv.includes('--mail-log')) {
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 3600 * 1000);
  const sql = "select timestamp, event_message from auth_logs where regexp_contains(lower(event_message), 'smtp|mail|535|534|auth') and regexp_contains(lower(event_message), 'error|fail') order by timestamp desc limit 8";
  const url = `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}&iso_timestamp_start=${start.toISOString()}&iso_timestamp_end=${end.toISOString()}`;
  const res = await fetch(url, { headers });
  const text = await res.text();
  console.log(`\n== Auth mail errors, last 6 h: HTTP ${res.status}`);
  let rows = [];
  try { rows = JSON.parse(text).result ?? []; } catch { console.log(text.slice(0, 300)); }
  const redact = (s) => String(s).replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>').replace(/"(password|pass|token)"\s*:\s*"[^"]*"/gi, '"$1":"<hidden>"');
  for (const r of rows) console.log(`${new Date(Number(r.timestamp) / 1000).toISOString()} ${redact(r.event_message).slice(0, 600)}`);
  if (!res.ok) console.log('(logs API unavailable: read Dashboard → Logs → Auth instead)');
  else if (!rows.length) console.log('(no matching rows)');
}

process.exit(failed ? 1 : 0);
