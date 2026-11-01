// Throwaway staging account for the Android UI check (emulator). Never production; prints no secrets.
//   create: makes an 18+ account with a profile and finished onboarding, writes its id/email/one-time code to
//           $GITHUB_ENV (the code is masked in logs) so the emulator flow can sign in without sending an email.
//   delete: removes every account this script created (email prefix), including leftovers from failed runs, and
//           every test race it created (slug prefix).
//   create --with-race: also makes a published test race starting in 20 minutes with its pin at
//           10.6500, -61.5000 (an open area, staging only) and writes CHECKIN_EVENT_ID to $GITHUB_ENV.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/ui-check-account.mjs create|delete
import { appendFileSync } from 'node:fs';

const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, GITHUB_ENV, GITHUB_RUN_ID } = process.env;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
if (!/^https:\/\/fmnmylqxrmxuzmdcvmhs\.supabase\.co$/.test(url)) throw new Error('UI check accounts are only made on staging');
const PREFIX = 'ui-check-';
const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };

async function call(path, init = {}) {
  const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]}: HTTP ${res.status} ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : null;
}

async function create() {
  const email = `${PREFIX}${GITHUB_RUN_ID ?? Date.now()}@example.com`;
  const user = await call('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, email_confirm: true, user_metadata: { date_of_birth: '1990-01-01' } }),
  });
  const [area] = await call('/rest/v1/regions?kind=eq.area&select=id&order=sort&limit=1');
  const prefer = { prefer: 'return=minimal' };
  await call('/rest/v1/profiles', { method: 'POST', headers: prefer, body: JSON.stringify({ id: user.id, display_name: 'UI Check', date_of_birth: '1990-01-01', home_region_id: area.id }) });
  await call('/rest/v1/user_roles', { method: 'POST', headers: prefer, body: JSON.stringify({ user_id: user.id, role: 'participant' }) });
  await call('/rest/v1/user_preferences', { method: 'POST', headers: prefer, body: JSON.stringify({ user_id: user.id, region_ids: [], distance_km: [], onboarded_at: new Date().toISOString() }) });
  const link = await call('/auth/v1/admin/generate_link', { method: 'POST', body: JSON.stringify({ type: 'magiclink', email }) });
  const otp = link.email_otp ?? link.properties?.email_otp;
  if (!otp) throw new Error('no one-time code returned');
  console.log(`::add-mask::${otp}`);
  if (GITHUB_ENV) appendFileSync(GITHUB_ENV, `UI_EMAIL=${email}\nUI_OTP=${otp}\n`);
  console.log(`created staging UI-check account ${email}`);
  if (process.argv.includes('--with-race')) {
    const slug = `${PREFIX}race-${GITHUB_RUN_ID ?? Date.now()}`;
    const [ev] = await call('/rest/v1/events?select=id', {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        listing_source: 'runlime', slug, name: 'UI check race (automated test)', starts_at: new Date(Date.now() + 20 * 60_000).toISOString(),
        region_id: area.id, venue_name: 'UI check venue', start_lat: 10.65, start_lng: -61.5, registration_url: 'https://example.org/ui-check',
        status: 'published', published_at: new Date().toISOString(),
      }),
    });
    if (GITHUB_ENV) appendFileSync(GITHUB_ENV, `CHECKIN_EVENT_ID=${ev.id}\n`);
    console.log(`created staging test race ${ev.id}`);
  }
}

async function remove() {
  const { users } = await call('/auth/v1/admin/users?per_page=200');
  const mine = users.filter((u) => u.email?.startsWith(PREFIX) && u.email.endsWith('@example.com'));
  for (const u of mine) await call(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' });
  console.log(`deleted ${mine.length} UI-check account(s)`);
  const races = await call(`/rest/v1/events?slug=like.${PREFIX}race-*&select=id`, { method: 'DELETE', headers: { prefer: 'return=representation' } });
  console.log(`deleted ${races.length} UI-check race(s)`);
}

// report: the saved runs of UI-check accounts (numbers only, test accounts only), as evidence for the run check.
async function report() {
  const { users } = await call('/auth/v1/admin/users?per_page=200');
  const ids = users.filter((u) => u.email?.startsWith(PREFIX) && u.email.endsWith('@example.com')).map((u) => u.id);
  if (!ids.length) return console.log('no UI-check accounts');
  const runs = await call(`/rest/v1/runs?user_id=in.(${ids.join(',')})&select=distance_m,point_count,moving_seconds,elapsed_seconds,event_id`);
  if (!runs.length) console.log('INFO  saved runs on staging: none');
  for (const r of runs) console.log(`INFO  saved run on staging: ${r.distance_m} m, ${r.point_count} kept points, moving ${r.moving_seconds} s, elapsed ${r.elapsed_seconds} s, linked to the test race: ${r.event_id ? 'yes' : 'no'}`);
}

const cmd = process.argv[2];
if (cmd === 'create') await create();
else if (cmd === 'delete') await remove();
else if (cmd === 'report') await report();
else throw new Error('usage: create | delete | report');
