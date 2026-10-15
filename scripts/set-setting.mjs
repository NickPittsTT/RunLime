// Set one app_settings value in a hosted environment (service role; runs only in GitHub Actions).
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/set-setting.mjs <key> '<json value>'
const [key, raw] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const keyHeader = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key || raw === undefined || !url || !keyHeader) throw new Error('usage: set-setting.mjs <key> <json value> (with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
if (key === 'legal.operator_address') {
  // Workflow inputs and logs would expose a private address. Enter it in the Supabase Table Editor instead.
  throw new Error('Refusing to set legal.operator_address here: it is private; enter it in Supabase → Table Editor → app_settings');
}
if (!/^legal\.(operator_name|support_email|child_safety_contact_email|website)$/.test(key)) {
  throw new Error(`Refusing to set "${key}": only legal operator/contact settings can be set with this tool`);
}
const value = JSON.parse(raw);
const res = await fetch(`${url}/rest/v1/app_settings?key=eq.${encodeURIComponent(key)}`, {
  method: 'PATCH',
  headers: { apikey: keyHeader, authorization: `Bearer ${keyHeader}`, 'content-type': 'application/json', prefer: 'return=representation' },
  body: JSON.stringify({ value }),
});
const rows = await res.json();
if (!res.ok || !Array.isArray(rows) || rows.length !== 1) throw new Error(`Update failed: HTTP ${res.status} ${JSON.stringify(rows).slice(0, 200)}`);
console.log(`${key} = ${JSON.stringify(rows[0].value)}`);
