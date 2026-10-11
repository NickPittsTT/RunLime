/**
 * Dev/staging seed: one account per role + sample events across Trinidad and Tobago.
 * All events are fictional SAMPLE data (names do not refer to real organisers).
 * Refuses to run against production. Idempotent: safe to re-run.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... pnpm seed:dev
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { adminClient, assertNonProduction } from './lib/env';
import { totp } from './lib/totp';

const DEV_PASSWORD = process.env.SEED_DEV_PASSWORD ?? 'runlime-dev-only-4821';

interface SeedUser {
  email: string;
  displayName: string;
  nickname?: string;
  dob: string;
  area: string;
  roles: string[];
  privacy?: 'private' | 'public';
  mfa?: boolean;
}

const USERS: SeedUser[] = [
  { email: 'super@runlime.test', displayName: 'Sam Super', dob: '1984-04-12', area: 'Port of Spain & North-West', roles: ['participant', 'super_admin'], mfa: true },
  { email: 'admin@runlime.test', displayName: 'Ana Admin', dob: '1991-09-23', area: 'Central', roles: ['participant', 'platform_admin'], mfa: true },
  { email: 'organiser@runlime.test', displayName: 'Omar Organiser', nickname: 'CoachOmar', dob: '1979-01-30', area: 'East-West Corridor', roles: ['participant'] },
  { email: 'organiser.pending@runlime.test', displayName: 'Petra Pending', dob: '1995-07-07', area: 'South', roles: ['participant'] },
  { email: 'runner@runlime.test', displayName: 'Rhea Runner', nickname: 'RheaRuns', dob: '1998-03-15', area: 'Port of Spain & North-West', roles: ['participant'] },
  { email: 'runner.public@runlime.test', displayName: 'Paul Public', nickname: 'PaulPaces', dob: '1989-11-02', area: 'Tobago', roles: ['participant'], privacy: 'public' },
];

async function regionIds(db: SupabaseClient) {
  const { data, error } = await db.from('regions').select('id,name,kind');
  if (error) throw error;
  const byName = new Map(data.map((r) => [r.name as string, r.id as string]));
  return (name: string) => {
    const id = byName.get(name);
    if (!id) throw new Error(`Unknown region ${name}`);
    return id;
  };
}

async function findUserId(db: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(db: SupabaseClient, region: (n: string) => string, u: SeedUser): Promise<string> {
  let id = await findUserId(db, u.email);
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email: u.email,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: {},
    });
    if (error) throw error;
    id = data.user.id;
  }
  const { error: pErr } = await db.from('profiles').upsert({
    id,
    display_name: u.displayName,
    nickname: u.nickname ?? null,
    date_of_birth: u.dob,
    home_region_id: region(u.area),
    account_privacy: u.privacy ?? 'private',
  });
  if (pErr) throw pErr;
  const { error: rErr } = await db.from('user_roles').upsert(u.roles.map((role) => ({ user_id: id, role })), { onConflict: 'user_id,role' });
  if (rErr) throw rErr;
  return id;
}

async function ensureTotp(url: string, anonKey: string, email: string): Promise<string | null> {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: DEV_PASSWORD });
  if (signInErr) throw signInErr;
  const { data: factors } = await client.auth.mfa.listFactors();
  if (factors?.totp.some((f) => f.status === 'verified')) return null; // already enrolled (secret printed on first run)
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'seed' });
  if (error) throw error;
  const secret = data.totp.secret;
  const { error: vErr } = await client.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(secret) });
  if (vErr) throw vErr;
  return secret;
}

function daysFromNow(days: number, hour: number, minute = 0): string {
  // Port of Spain is UTC-4 all year (no DST).
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour + 4, minute, 0, 0);
  return d.toISOString();
}

async function main() {
  const { url, client: db } = adminClient();
  assertNonProduction(url);
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('SUPABASE_ANON_KEY is required (used to enrol seeded admins in TOTP)');
  const region = await regionIds(db);

  const ids: Record<string, string> = {};
  for (const u of USERS) ids[u.email] = await ensureUser(db, region, u);

  const secrets: Record<string, string> = {};
  for (const u of USERS.filter((x) => x.mfa)) {
    const s = await ensureTotp(url, anonKey, u.email);
    if (s) secrets[u.email] = s;
  }

  // Organisations
  const orgs = [
    { slug: 'savannah-striders-sample', name: 'Savannah Striders (Sample)', status: 'verified', owner: 'organiser@runlime.test', is_charity: false },
    { slug: 'southern-strides-sample', name: 'Southern Strides (Sample)', status: 'applied', owner: 'organiser.pending@runlime.test', is_charity: true },
  ];
  const orgIds: Record<string, string> = {};
  for (const o of orgs) {
    const { data, error } = await db
      .from('organisations')
      .upsert(
        {
          slug: o.slug,
          name: o.name,
          contact_email: `events@${o.slug}.example`,
          contact_phone: '+1 868 555 0100',
          about: 'Sample organisation used for development and testing. Not a real organiser.',
          is_charity: o.is_charity,
          status: o.status,
          reviewed_at: o.status === 'verified' ? new Date().toISOString() : null,
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single();
    if (error) throw error;
    orgIds[o.slug] = data.id;
    await db.from('organisation_members').upsert({ organisation_id: data.id, user_id: ids[o.owner], role: 'owner' });
    if (o.status === 'verified') await db.from('user_roles').upsert({ user_id: ids[o.owner], role: 'organiser' });
  }

  // Clubs
  for (const c of [
    { name: 'Port of Spain Pacers (Sample)', region: 'Port of Spain & North-West' },
    { name: 'Central Harriers (Sample)', region: 'Central' },
    { name: 'Tobago Trail Runners (Sample)', region: 'Tobago' },
  ]) {
    const { data: existing } = await db.from('clubs').select('id').eq('name', c.name).maybeSingle();
    if (!existing) await db.from('clubs').insert({ name: c.name, region_id: region(c.region), description: 'Sample club for development.' });
  }

  // Events — fictional SAMPLE races at real public venues, dates relative to today.
  const org = orgIds['savannah-striders-sample']!;
  const events = [
    ['savannah-sunrise-5k', 'Savannah Sunrise 5K', 9, 5, 30, 'Port of Spain & North-West', 'Port of Spain City Corporation', "Queen's Park Savannah", 10.6699, -61.5146, 120, 'published', true, [5]],
    ['chaguaramas-boardwalk-5k', 'Chaguaramas Boardwalk 5K', 16, 6, 0, 'Port of Spain & North-West', 'Diego Martin Regional Corporation', 'Chaguaramas Boardwalk', 10.6806, -61.6406, 100, 'published', true, [5]],
    ['san-fernando-hill-run', 'San Fernando Hill Run', 23, 6, 0, 'South', 'San Fernando City Corporation', 'San Fernando Hill', 10.2797, -61.4581, 150, 'published', false, [5, 10]],
    ['arima-velodrome-fun-run', 'Arima Velodrome Fun Run & Walk', 30, 6, 30, 'East-West Corridor', 'Arima Borough Corporation', 'Arima Velodrome', 10.6347, -61.2827, 80, 'published', true, [2, 5]],
    ['pigeon-point-sunrise-5k', 'Pigeon Point Sunrise 5K', 37, 5, 45, 'Tobago', 'Tobago House of Assembly', 'Pigeon Point', 11.1648, -60.8467, 150, 'published', true, [5]],
    ['couva-charity-walk-run', 'Couva Charity Walk/Run', 44, 6, 0, 'Central', 'Couva–Tabaquite–Talparo Regional Corporation', 'Couva town centre', 10.4219, -61.4472, 0, 'published', true, [3, 5]],
    ['point-fortin-borough-5k', 'Point Fortin Borough Day 5K', 51, 6, 0, 'South', 'Point Fortin Borough Corporation', 'Point Fortin Mahaica Oval', 10.1736, -61.6844, 100, 'published', false, [5]],
    ['chaguanas-night-run', 'Chaguanas Night Run 5K', 58, 18, 30, 'Central', 'Chaguanas Borough Corporation', 'Chaguanas Main Road', 10.5167, -61.4114, 120, 'published', false, [5]],
    ['sangre-grande-heritage-5k', 'Sangre Grande Heritage 5K', 65, 6, 0, 'North-East', 'Sangre Grande Regional Corporation', 'Sangre Grande Recreation Ground', 10.5873, -61.1306, 100, 'postponed', true, [5]],
    ['mayaro-beach-run', 'Mayaro Beach Run', 72, 6, 0, 'South', 'Mayaro–Rio Claro Regional Corporation', 'Mayaro Beach', 10.2950, -61.0130, 120, 'cancelled', false, [5]],
    ['tunapuna-community-5k', 'Tunapuna Community 5K', 79, 6, 0, 'East-West Corridor', 'Tunapuna–Piarco Regional Corporation', 'Tunapuna Hasely Crawford Park', 10.6500, -61.3870, 100, 'published', true, [5]],
    ['diego-martin-river-run', 'Diego Martin River Run', 86, 6, 0, 'Port of Spain & North-West', 'Diego Martin Regional Corporation', 'Diego Martin Sporting Complex', 10.7208, -61.5664, 100, 'pending_approval', false, [5, 10]],
    ['princes-town-5k', 'Princes Town 5K', 93, 6, 0, 'South', 'Princes Town Regional Corporation', 'Princes Town Recreation Ground', 10.2690, -61.3800, 80, 'draft', true, [5]],
    ['scarborough-harbour-5k', 'Scarborough Harbour 5K', 100, 6, 0, 'Tobago', 'Tobago House of Assembly', 'Scarborough Esplanade', 11.1810, -60.7370, 120, 'published', true, [5]],
    ['penal-debe-5k', 'Penal–Debe 5K', 107, 6, 0, 'South', 'Penal–Debe Regional Corporation', 'Penal Recreation Ground', 10.1660, -61.4580, 80, 'published', true, [5]],
    ['siparia-fete-run', 'Siparia Fun Run', 114, 6, 0, 'South', 'Siparia Regional Corporation', 'Siparia Recreation Ground', 10.1440, -61.5080, 60, 'published', true, [3, 5]],
    ['laventille-hills-challenge', 'Laventille Hills Challenge', 121, 6, 0, 'East-West Corridor', 'San Juan–Laventille Regional Corporation', 'Laventille', 10.6490, -61.4950, 150, 'published', false, [5]],
    // past events (history, check-ins and community boards in later phases)
    ['savannah-sunrise-5k-past', 'Savannah Sunrise 5K (last month)', -30, 5, 30, 'Port of Spain & North-West', 'Port of Spain City Corporation', "Queen's Park Savannah", 10.6699, -61.5146, 120, 'published', true, [5]],
    ['chaguaramas-boardwalk-5k-past', 'Chaguaramas Boardwalk 5K (last week)', -7, 6, 0, 'Port of Spain & North-West', 'Diego Martin Regional Corporation', 'Chaguaramas Boardwalk', 10.6806, -61.6406, 100, 'published', true, [5]],
    ['arima-velodrome-fun-run-past', 'Arima Velodrome Fun Run (last year)', -340, 6, 30, 'East-West Corridor', 'Arima Borough Corporation', 'Arima Velodrome', 10.6347, -61.2827, 80, 'published', true, [2, 5]],
  ] as const;

  for (const [slug, name, days, hour, minute, area, corp, venue, lat, lng, fee, status, walk, distances] of events) {
    const { data, error } = await db
      .from('events')
      .upsert(
        {
          organisation_id: org,
          slug: `${slug}-sample`,
          name: `${name} (Sample)`,
          description: 'SAMPLE EVENT for development and testing. Not a real race.',
          starts_at: daysFromNow(days, hour, minute),
          region_id: region(area),
          corporation_id: region(corp),
          venue_name: venue,
          start_lat: lat,
          start_lng: lng,
          registration_instructions: 'Sample: register with the organiser at package collection.',
          fee_min: fee,
          fee_max: fee === 0 ? null : fee,
          walk_friendly: walk,
          cause: fee === 0 ? 'Community health' : null,
          status,
          status_reason: status === 'postponed' ? 'Sample: venue unavailable' : status === 'cancelled' ? 'Sample: weather warning' : null,
          published_at: ['published', 'postponed', 'cancelled'].includes(status) ? new Date().toISOString() : null,
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single();
    if (error) throw error;
    await db.from('event_distances').delete().eq('event_id', data.id);
    const { error: dErr } = await db
      .from('event_distances')
      .insert(distances.map((km) => ({ event_id: data.id, distance_km: km, label: km === 5 ? '5K' : km === 10 ? '10K' : `${km}K walk` })));
    if (dErr) throw dErr;
  }

  console.log(`Seeded ${USERS.length} users, ${orgs.length} organisations, ${events.length} sample events.`);
  console.log(`Dev password for all seeded users: ${DEV_PASSWORD} (dev/staging only; production users have no passwords).`);
  for (const [email, secret] of Object.entries(secrets)) {
    console.log(`TOTP secret for ${email}: ${secret}  (add to an authenticator app; shown only on first enrolment)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
