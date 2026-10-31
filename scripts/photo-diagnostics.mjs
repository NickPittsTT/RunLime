// Read-only: why does a viewer see initials instead of a photo? (owner retest R9). Runs only in GitHub Actions
// ("Staging diagnostics" → photos). Logs are public: accounts are shown as letters, no ids, emails or photo paths.
//   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node scripts/photo-diagnostics.mjs
const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref } = process.env;
if (!token || !ref) throw new Error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required');
async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}
const letters = new Map();
const who = (id) => {
  if (!letters.has(id)) letters.set(id, String.fromCharCode(65 + letters.size));
  return letters.get(id);
};

const people = await sql(`select id, account_privacy::text as privacy, avatar_path is not null as has_photo, avatar_updated_at
  from public.profiles order by created_at`);
console.log('\n===== 1. Accounts =====');
for (const p of people) console.log(`  account ${who(p.id)}  ${p.privacy.padEnd(7)}  photo: ${p.has_photo ? 'yes' : 'no'}${p.avatar_updated_at ? `  (photo changed ${p.avatar_updated_at})` : ''}`);

console.log('\n===== 2. Privacy and photo changes, last 3 days (audit log) =====');
const audit = await sql(`select at, action, changed_fields, before ->> 'account_privacy' as before_privacy, after ->> 'account_privacy' as after_privacy
  from audit.log where table_name = 'profiles' and at > now() - interval '3 days'
    and (changed_fields && array['account_privacy', 'avatar_path'] or action <> 'update') order by at`);
if (!audit.length) console.log('  (none recorded; account_privacy may not be in the audit allowlist)');
for (const a of audit) console.log(`  ${a.at}  ${a.action}  ${a.changed_fields.join(',')}  privacy ${a.before_privacy ?? '?'} → ${a.after_privacy ?? '?'}`);

console.log('\n===== 3. What each signed-in account is served for each account with a photo =====');
const follows = await sql(`select follower_id, followee_id, status::text from public.follows`);
const fol = (v, p) => follows.find((f) => f.follower_id === v && f.followee_id === p)?.status ?? 'none';
for (const p of people.filter((x) => x.has_photo)) {
  for (const v of people.filter((x) => x.id !== p.id)) {
    const claims = JSON.stringify({ sub: v.id, role: 'authenticated', aal: 'aal1' }).replace(/'/g, "''");
    const [row] = await sql(`with c as (select set_config('request.jwt.claims', '${claims}', true) as s)
      select public.visible_avatar('${p.id}', (select avatar_path from public.profiles where id = '${p.id}')) is not null as vis_fn,
             (public.profile_card('${p.id}') ->> 'avatar_path') is not null as vis_card
      from c`).catch((e) => [{ error: e.message.slice(0, 120) }]);
    const expected = p.privacy === 'public' || fol(v.id, p.id) === 'accepted';
    const got = row.error ? `error ${row.error}` : `visible_avatar ${row.vis_fn ? 'photo' : 'initials'}, profile_card ${row.vis_card ? 'photo' : 'initials'}`;
    const ok = !row.error && row.vis_fn === expected && row.vis_card === expected;
    console.log(`  ${ok ? 'OK  ' : 'BAD '} viewer ${who(v.id)} → account ${who(p.id)} (${p.privacy}, follow: ${fol(v.id, p.id)}): ${got}; expected ${expected ? 'photo' : 'initials'}`);
  }
}

console.log('\n===== 4. Live function definitions =====');
const defs = await sql(`select p.proname, p.prosecdef as definer, p.provolatile, pg_get_userbyid(p.proowner) as owner,
  position('visible_avatar' in pg_get_functiondef(p.oid)) > 0 as uses_visible_avatar
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('visible_avatar', 'profile_card', 'search_people', 'my_connections', 'following_going', 'club_page')`);
console.table(defs);
const [rls] = await sql(`select rolbypassrls from pg_roles where rolname = (select pg_get_userbyid(proowner) from pg_proc where proname = 'visible_avatar' limit 1)`);
console.log(`  visible_avatar owner bypasses row security: ${rls?.rolbypassrls}`);
