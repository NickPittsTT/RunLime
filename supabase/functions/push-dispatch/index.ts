// Sends new in-app notifications to people's phones through Expo Push (FCM on Android), then checks Expo receipts
// about 15 minutes later. Called every minute by pg_cron (public.dispatch_push) with the shared secret from Vault;
// never by apps. Logs error codes and counts only (never tokens or notification text).
import { buildPushMessages, chunk, deadTokens, readReceipts, receiptsToTrack, ticketErrorCodes, type PendingNotification, type PushTicket } from '../_shared/push.ts';

const url = () => Deno.env.get('SUPABASE_URL')!;
const key = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${url()}/rest/v1/${path}`, { ...init, headers: { authorization: `Bearer ${key()}`, apikey: key(), 'content-type': 'application/json', ...(init.headers ?? {}) } });
const EXPO_PUSH_URL = Deno.env.get('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = Deno.env.get('EXPO_RECEIPTS_URL') ?? 'https://exp.host/--/api/v2/push/getReceipts';
const quoted = (xs: string[]) => xs.map((x) => `"${x}"`).join(',');

function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendPending(): Promise<{ sent: number; removed: number; errors: Record<string, number> }> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const pending = (await (await rest(`notifications?push_sent_at=is.null&created_at=gt.${since}&select=id,user_id,kind,title,body,data&order=created_at&limit=500`)).json()) as PendingNotification[];
  if (!Array.isArray(pending) || pending.length === 0) return { sent: 0, removed: 0, errors: {} };
  const users = [...new Set(pending.map((n) => n.user_id))];
  const tokens = (await (await rest(`push_tokens?user_id=in.(${users.join(',')})&select=token,user_id`)).json()) as { token: string; user_id: string }[];
  const byUser = new Map<string, string[]>();
  for (const t of tokens) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t.token]);

  // Mark first so a slow run can't send twice; notifications without phones are marked too.
  await rest(`notifications?id=in.(${pending.map((n) => n.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ push_sent_at: new Date().toISOString() }), headers: { prefer: 'return=minimal' } });

  const messages = buildPushMessages(pending, byUser);
  const dead: string[] = [];
  const errors: Record<string, number> = {};
  const track: { ticket_id: string; token: string }[] = [];
  for (const batch of chunk(messages)) {
    const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(batch) });
    if (!res.ok) {
      console.error('push-dispatch: Expo send returned HTTP', res.status);
      errors[`http_${res.status}`] = (errors[`http_${res.status}`] ?? 0) + batch.length;
      continue;
    }
    const tickets = ((await res.json()) as { data?: PushTicket[] }).data ?? [];
    for (const [code, n] of Object.entries(ticketErrorCodes(tickets))) errors[code] = (errors[code] ?? 0) + n;
    dead.push(...deadTokens(batch, tickets));
    track.push(...receiptsToTrack(batch, tickets));
  }
  if (track.length) await rest('push_receipts', { method: 'POST', body: JSON.stringify(track), headers: { prefer: 'return=minimal,resolution=ignore-duplicates' } });
  if (dead.length) await rest(`push_tokens?token=in.(${quoted(dead)})`, { method: 'DELETE' });
  if (Object.keys(errors).length) console.error('push-dispatch: ticket errors', JSON.stringify(errors));
  return { sent: messages.length, removed: dead.length, errors };
}

/** Receipts are ready after a few minutes; Expo keeps them for a day. */
async function checkReceipts(): Promise<{ checked: number; errors: Record<string, number> }> {
  const before = new Date(Date.now() - 15 * 60_000).toISOString();
  const rows = (await (await rest(`push_receipts?created_at=lt.${before}&select=ticket_id,token&order=created_at&limit=300`)).json()) as { ticket_id: string; token: string }[];
  if (!Array.isArray(rows) || rows.length === 0) return { checked: 0, errors: {} };
  const res = await fetch(EXPO_RECEIPTS_URL, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ ids: rows.map((r) => r.ticket_id) }) });
  if (!res.ok) {
    console.error('push-dispatch: Expo receipts returned HTTP', res.status);
    return { checked: 0, errors: { [`receipts_http_${res.status}`]: rows.length } };
  }
  const receipts = ((await res.json()) as { data?: Record<string, { status: string; details?: { error?: string } }> }).data ?? {};
  const { errors, dead, done } = readReceipts(rows, receipts);
  if (dead.length) await rest(`push_tokens?token=in.(${quoted(dead)})`, { method: 'DELETE' });
  // Done receipts, plus any Expo no longer has (older than a day), are removed.
  const stale = new Date(Date.now() - 24 * 3600_000).toISOString();
  if (done.length) await rest(`push_receipts?ticket_id=in.(${quoted(done)})`, { method: 'DELETE' });
  await rest(`push_receipts?created_at=lt.${stale}`, { method: 'DELETE' });
  if (Object.keys(errors).length) console.error('push-dispatch: receipt errors', JSON.stringify(errors));
  return { checked: done.length, errors };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';
  if (req.method !== 'POST' || !secret || !sameSecret(req.headers.get('x-dispatch-secret') ?? '', secret)) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const sent = await sendPending();
    const receipts = await checkReceipts();
    return Response.json({ ...sent, receipts });
  } catch (err) {
    console.error('push-dispatch failed', err instanceof Error ? err.message : 'unknown');
    return new Response('error', { status: 500 });
  }
});
