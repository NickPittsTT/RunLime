// Read-only push delivery diagnostics for a hosted environment (runs only in GitHub Actions, "Staging diagnostics"
// → push). Logs are public: push tokens and user IDs are masked, no emails, no secrets.
//   SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF SUPABASE_SERVICE_ROLE_KEY EXPO_TOKEN [SEND_TEST=true]
// With SEND_TEST=true it sends ONE test notification to each registered phone through Expo and prints the ticket
// and receipt (all registered phones are the owner's test devices; no outside testers before Phase 6).
const { SUPABASE_ACCESS_TOKEN: mgmt, SUPABASE_PROJECT_REF: ref, SUPABASE_SERVICE_ROLE_KEY: key, EXPO_TOKEN: expoToken } = process.env;
const sendTest = process.env.SEND_TEST === 'true';
if (!mgmt || !ref || !key) throw new Error('SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF and SUPABASE_SERVICE_ROLE_KEY are required');

const maskToken = (t) => (typeof t === 'string' ? t.replace(/\[(.{4}).*(.{3})\]$/, '[$1…$2]') : String(t));
const maskAll = (s) => String(s).replace(/Expo(nent)?PushToken\[[^\]]+\]/g, (m) => maskToken(m));
const maskId = (id) => (typeof id === 'string' ? `${id.slice(0, 8)}…` : String(id));
const section = (title) => console.log(`\n===== ${title} =====`);

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${mgmt}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) return { error: `HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}` };
  return { rows: body };
}
const table = (r) => (r.error ? console.log('  query failed:', r.error) : r.rows.length ? console.table(r.rows) : console.log('  (none)'));

// 1. Tokens
section('1. Push tokens (masked)');
const tokens = await sql(`
  select t.token, t.platform, t.user_id::text, t.created_at, t.last_seen_at,
         exists (select 1 from public.user_roles r where r.user_id = t.user_id and r.role = 'super_admin') as is_super_admin
    from public.push_tokens t order by t.last_seen_at desc`);
if (tokens.error) console.log('  query failed:', tokens.error);
else {
  console.table(tokens.rows.map((t) => ({ ...t, token: maskToken(t.token), user_id: maskId(t.user_id), expo_format: /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(t.token) })));
}

// 2. Dispatch: notifications sent status, cron runs, function responses, Vault config
section('2a. Recent notifications for users with a phone (sent status)');
table(await sql(`
  select n.kind, n.created_at, n.push_sent_at, left(n.user_id::text, 8) || '…' as user_id
    from public.notifications n
   where n.user_id in (select user_id from public.push_tokens)
   order by n.created_at desc limit 15`));
section('2b. Dispatch configured (Vault)');
table(await sql(`select name, decrypted_secret is not null and decrypted_secret <> '' as present from vault.decrypted_secrets where name in ('push_dispatch_url', 'push_dispatch_secret')`));
section('2c. Cron job push-dispatch: last runs');
table(await sql(`
  select d.start_time, d.status, left(d.return_message, 120) as return_message
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
   where j.jobname = 'push-dispatch' order by d.start_time desc limit 8`));
section('2d. Edge Function responses (pg_net), non-empty sends first');
table(await sql(`
  select created, status_code, timed_out, left(coalesce(error_msg, ''), 120) as error_msg, left(content::text, 160) as content
    from net._http_response order by (content::text like '%"sent":0%') asc, created desc limit 12`));

section('2e. Notifications in the last 48 h: how many were handed to the dispatcher (push_sent_at set)');
table(await sql(`
  select date_trunc('hour', n.created_at) as hour, n.kind, count(*)::int as total, count(n.push_sent_at)::int as dispatched,
         bool_or(exists (select 1 from public.user_roles r where r.user_id = n.user_id and r.role = 'super_admin')) as incl_super_admin
    from public.notifications n where n.created_at > now() - interval '48 hours'
   group by 1, 2 order by 1 desc limit 40`));

// Supabase logs (ClickHouse SQL, one "logs" table). Messages can contain IP addresses, so only the time, method,
// status and RPC/function name are printed.
async function logRows(query) {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600_000);
  const qs = new URLSearchParams({ sql: query, iso_timestamp_start: start.toISOString(), iso_timestamp_end: end.toISOString() });
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs?${qs}`, { headers: { authorization: `Bearer ${mgmt}` } });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) return { error: `${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}` };
  return { rows: body?.result ?? body?.data ?? [] };
}
function printCalls(r, pattern) {
  if (r.error) return console.log('  logs query failed:', r.error);
  if (!r.rows.length) return console.log('  (none in the last 24 h)');
  for (const row of r.rows) {
    const msg = String(row.event_message ?? '');
    const method = msg.match(/\b(GET|POST|PATCH|DELETE|PUT|OPTIONS)\b/)?.[1] ?? '?';
    const status = msg.match(/\|\s*(\d{3})\s*\|/)?.[1] ?? msg.match(/\b([1-5]\d\d)\b/)?.[1] ?? '?';
    const name = msg.match(pattern)?.[0] ?? '?';
    console.log(`  ${row.timestamp}  ${method} ${name} -> ${status}`);
  }
}
section('2f. App calls to register/unregister a phone (API gateway, last 24 h)');
printCalls(await logRows(`select timestamp, event_message from logs where source_name = 'edge_logs' and event_message like '%push_token%' order by timestamp desc limit 50`), /(un)?register_push_token/);
section('2g. Calls to the push-dispatch function (last 24 h)');
printCalls(await logRows(`select timestamp, event_message from logs where source_name = 'function_edge_logs' and event_message like '%push-dispatch%' order by timestamp desc limit 20`), /push-dispatch/);

// 3/4. Expo: credentials for the package, then an optional direct test push
const APP_ID = 'tt.runlime.app.dev';
if (expoToken) {
  section('4. Expo credentials for tt.runlime.app.dev');
  const r = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${expoToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `query($appId: String!, $pkg: String) { app { byId(appId: $appId) { fullName androidAppCredentials(filter: { applicationIdentifier: $pkg }) {
        applicationIdentifier googleServiceAccountKeyForFcmV1 { projectIdentifier createdAt } androidAppBuildCredentialsList { id } } } } }`,
      variables: { appId: 'ca1a5ee2-b15a-488d-b123-8fd075db8be1', pkg: APP_ID },
    }),
  });
  const body = await r.json().catch(() => null);
  if (body?.errors) console.log('  Expo error:', body.errors[0]?.extensions?.errorCode, body.errors[0]?.message);
  else {
    const app = body?.data?.app?.byId;
    console.log(`  Expo project: ${app?.fullName}`);
    for (const c of app?.androidAppCredentials ?? []) {
      console.log(`  ${c.applicationIdentifier}: FCM V1 key project ${c.googleServiceAccountKeyForFcmV1?.projectIdentifier ?? 'NONE'}, build credentials ${c.androidAppBuildCredentialsList.length}`);
    }
    if (!app?.androidAppCredentials?.length) console.log('  no Android credentials record');
  }
}

if (sendTest && !tokens.error) {
  section('3. Direct test push through Expo (ticket, then receipt)');
  const list = tokens.rows.map((t) => t.token);
  if (list.length === 0) console.log('  no registered phones');
  const send = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(list.map((to) => ({ to, title: 'RunLime test notification', body: 'Push diagnostics: if you see this, phone notifications work.', sound: 'default', channelId: 'default', priority: 'high' }))),
  });
  const sent = await send.json().catch(() => null);
  console.log(`  send: HTTP ${send.status}`);
  if (sent?.errors) console.log('  request errors:', JSON.stringify(sent.errors).slice(0, 400));
  const tickets = sent?.data ?? [];
  tickets.forEach((t, i) => console.log(`  ticket ${maskToken(list[i])}: ${t.status}${t.id ? ` id ${t.id}` : ''}${t.message ? ` | ${t.message.replace(/ExponentPushToken\[[^\]]+\]/g, (m) => maskToken(m))}` : ''}${t.details ? ` | details ${maskAll(JSON.stringify(t.details))}` : ''}`));
  const ids = tickets.filter((t) => t.id).map((t) => t.id);
  if (ids.length) {
    await new Promise((r) => setTimeout(r, 20_000));
    const rec = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ ids }),
    });
    const receipts = (await rec.json().catch(() => null))?.data ?? {};
    for (const id of ids) {
      const r = receipts[id];
      console.log(`  receipt ${id}: ${r ? `${r.status}${r.message ? ` | ${r.message.replace(/ExponentPushToken\[[^\]]+\]/g, (m) => maskToken(m))}` : ''}${r.details ? ` | details ${maskAll(JSON.stringify(r.details))}` : ''}` : 'not ready yet'}`);
    }
  }
}
