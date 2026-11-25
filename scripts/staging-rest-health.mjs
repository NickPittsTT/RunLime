// Staging health without the Supabase Management API (read-only; prints counts, names and status codes only, never
// row contents or key values). Uses the project's own REST/Auth/Storage/Functions endpoints with the legacy keys.
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/staging-rest-health.mjs
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service } = process.env;
if (!url || !anon || !service) throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required');
if (!/^https:\/\/fmnmylqxrmxuzmdcvmhs\.supabase\.co$/.test(url)) throw new Error('staging only');
const h = (key) => ({ apikey: key, authorization: `Bearer ${key}` });
const line = (s) => console.log(s);

line('===== Auth: public settings (anon key) =====');
{
  const r = await fetch(`${url}/auth/v1/settings`, { headers: h(anon) });
  const s = r.ok ? await r.json() : null;
  if (!s) line(`  HTTP ${r.status}`);
  else {
    const on = Object.entries(s.external ?? {}).filter(([, v]) => v === true).map(([k]) => k);
    line(`  sign-in methods enabled: ${on.join(', ') || 'none'}`);
    line(`  signups disabled: ${s.disable_signup} | email autoconfirm: ${s.mailer_autoconfirm} | phone autoconfirm: ${s.phone_autoconfirm}`);
  }
}
line('===== Auth: accounts (service key; count only) =====');
{
  const r = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1`, { headers: h(service) });
  const total = r.headers.get('x-total-count');
  line(`  HTTP ${r.status}; accounts: ${total ?? 'header not returned'}`);
}
line('===== Database: row counts (service key; counts only) =====');
const tables = ['profiles', 'user_roles', 'consents', 'regions', 'countries', 'app_settings', 'legal_documents', 'organisations', 'organisation_members',
  'events', 'event_distances', 'event_changes', 'event_media', 'event_messages', 'rsvps', 'follows', 'blocks', 'clubs', 'club_members', 'reports',
  'notifications', 'notification_settings', 'push_tokens', 'push_receipts', 'race_suggestions', 'check_ins', 'checkin_attempts', 'checkin_help_requests',
  'venues', 'geocode_cache', 'runs'];
for (const t of tables) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=0`, { method: 'HEAD', headers: { ...h(service), prefer: 'count=exact' } });
  const range = r.headers.get('content-range');
  line(`  ${t.padEnd(24)} ${r.ok ? (range?.split('/')[1] ?? '?') : `HTTP ${r.status}`}`);
}
line('===== Storage buckets (service key; names and public flag) =====');
{
  const r = await fetch(`${url}/storage/v1/bucket`, { headers: h(service) });
  const b = r.ok ? await r.json() : [];
  if (!r.ok) line(`  HTTP ${r.status}`);
  for (const x of b) line(`  ${x.id}: ${x.public ? 'PUBLIC' : 'private'}`);
}
line('===== Edge Functions (no key sent: 401 = deployed and asking for sign-in; 404 = missing) =====');
for (const f of ['emergency-contact', 'emergency-contact-keys', 'export-user-data', 'profile-photo', 'push-dispatch', 'admin-alerts']) {
  const r = await fetch(`${url}/functions/v1/${f}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  line(`  ${f.padEnd(24)} HTTP ${r.status}`);
}
line('Done (read-only).');
