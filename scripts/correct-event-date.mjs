// Correct ONE published event's date in a hosted environment, with the reason recorded in the audit log.
// Runs only in GitHub Actions ("Correct event date"); use only with the owner's permission for that change.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_ANON_KEY=… WEB_URL=… \
//     node scripts/correct-event-date.mjs <event id> <ISO start with offset> "<reason>"
// Then checks what the app (public API, anon key) and the website race page show.
const [id, startsAt, reason] = process.argv.slice(2);
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_ANON_KEY: anon, WEB_URL: web } = process.env;
if (!id || !startsAt || !reason || !url || !key || !anon) throw new Error('usage: correct-event-date.mjs <id> <ISO start> "<reason>"');
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?[+-]\d{2}:\d{2}$/.test(startsAt)) throw new Error('Start must be ISO with an offset, e.g. 2026-10-31T06:00:00-04:00');

const service = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
const pub = { apikey: anon, authorization: `Bearer ${anon}` };
const COLS = 'id,name,slug,status,starts_at,original_starts_at,timezone';
const read = async (headers) => {
  const res = await fetch(`${url}/rest/v1/events?id=eq.${id}&select=${COLS}`, { headers });
  const rows = await res.json();
  if (!res.ok || !Array.isArray(rows) || rows.length !== 1) throw new Error(`Event lookup failed: HTTP ${res.status}`);
  return rows[0];
};
const fmt = (iso, timeZone) =>
  `${new Intl.DateTimeFormat('en-TT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(new Date(iso))}, ` +
  new Intl.DateTimeFormat('en-TT', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso));

const before = await read(service);
console.log(`Before: ${before.name} | ${before.status} | ${fmt(before.starts_at, before.timezone)} (${before.starts_at}) | original_starts_at ${before.original_starts_at}`);

const res = await fetch(`${url}/rest/v1/rpc/ops_correct_event_start`, {
  method: 'POST', headers: service, body: JSON.stringify({ p_id: id, p_starts_at: startsAt, p_reason: reason }),
});
if (!res.ok) throw new Error(`Correction refused: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
console.log(`Corrected, reason recorded in the audit log: "${reason}"`);

// What the app reads (public API with the anon key, same as the calendar list).
const after = await read(pub);
const want = new Date(startsAt).toISOString();
const shown = fmt(after.starts_at, after.timezone);
console.log(`App data: ${after.status} | ${shown} (${after.starts_at}) | original_starts_at ${after.original_starts_at}`);
if (after.status !== 'published' || new Date(after.starts_at).toISOString() !== want || after.original_starts_at !== null) {
  throw new Error('The public data does not match the correction');
}

// What the website race page shows.
if (web) {
  const [datePart] = shown.split(', ').slice(1, 2); // "31 Oct 2026"
  const timePart = shown.split(', ').pop().replace(/\s/g, ' '); // "6:00 am"
  let ok = false;
  for (let i = 0; i < 6 && !ok; i++) {
    const html = (await (await fetch(`${web.replace(/\/$/, '')}/e/${after.slug}`, { headers: { 'cache-control': 'no-cache' } })).text()).replace(/\s|&nbsp;|&#x202f;/gi, ' ');
    ok = html.includes(datePart) && html.includes(timePart.split(' ')[0]) && !html.includes('Postponed');
    if (!ok) await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log(`Website /e/${after.slug}: ${ok ? `shows ${datePart}, ${timePart}` : 'did NOT show the new date'}`);
  if (!ok) process.exit(1);
}
