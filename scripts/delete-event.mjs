// Delete ONE event in a hosted environment by its exact name (service role; runs only in GitHub Actions).
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/delete-event.mjs "<exact event name>"
// Refuses unless exactly one event has that name. Related rows (distances, history, media rows) cascade.
const [name] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!name || !url || !key) throw new Error('usage: delete-event.mjs "<exact name>" (with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: 'return=representation' };
const q = `${url}/rest/v1/events?name=eq.${encodeURIComponent(name)}&select=id,name,status,starts_at,listing_source`;
const found = await (await fetch(q, { headers })).json();
if (!Array.isArray(found)) throw new Error(`Lookup failed: ${JSON.stringify(found).slice(0, 200)}`);
if (found.length === 0) {
  console.log(`No event named "${name}" exists. Nothing deleted.`);
  process.exit(0);
}
if (found.length > 1) throw new Error(`${found.length} events are named "${name}"; refusing to delete. Use a unique name.`);
const [e] = found;
console.log(`Deleting: ${e.name} (${e.status}, ${e.listing_source}, starts ${e.starts_at}, id ${e.id})`);
const res = await fetch(`${url}/rest/v1/events?id=eq.${e.id}`, { method: 'DELETE', headers });
const rows = await res.json();
if (!res.ok || !Array.isArray(rows) || rows.length !== 1) throw new Error(`Delete failed: HTTP ${res.status} ${JSON.stringify(rows).slice(0, 200)}`);
console.log('Deleted.');
