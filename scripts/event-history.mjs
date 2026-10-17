// Read-only: list events matching a name (case-insensitive) with their status and change history.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/event-history.mjs "<name fragment>"
const [frag] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!frag || !url || !key) throw new Error('usage: event-history.mjs "<name fragment>"');
const headers = { apikey: key, authorization: `Bearer ${key}` };
const get = async (path) => {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  const body = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return body;
};
const events = await get(`events?name=ilike.${encodeURIComponent(`*${frag}*`)}&select=id,name,status,listing_source,starts_at,updated_at,created_at&order=created_at`);
console.log(`${events.length} event(s) matching "${frag}"`);
for (const e of events) {
  console.log(`\n${e.name} | ${e.status} | ${e.listing_source} | starts ${e.starts_at} | created ${e.created_at} | updated ${e.updated_at} | ${e.id}`);
  const changes = await get(`event_changes?event_id=eq.${e.id}&select=field,old_value,new_value,changed_at&order=changed_at`);
  for (const c of changes) console.log(`  ${c.changed_at}  ${c.field}: ${c.old_value} -> ${c.new_value}`);
}
