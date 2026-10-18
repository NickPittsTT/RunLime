// Sends new in-app notifications to people's phones through Expo Push (FCM on Android).
// Called every minute by pg_cron (public.dispatch_push) with the shared secret from Vault; never by apps.
import { buildPushMessages, chunk, deadTokens, type PendingNotification } from '../_shared/push.ts';

const url = () => Deno.env.get('SUPABASE_URL')!;
const key = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${url()}/rest/v1/${path}`, { ...init, headers: { authorization: `Bearer ${key()}`, apikey: key(), 'content-type': 'application/json', ...(init.headers ?? {}) } });
const EXPO_PUSH_URL = Deno.env.get('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send';

function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';
  if (req.method !== 'POST' || !secret || !sameSecret(req.headers.get('x-dispatch-secret') ?? '', secret)) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const pending = (await (await rest(`notifications?push_sent_at=is.null&created_at=gt.${since}&select=id,user_id,kind,title,body,data&order=created_at&limit=500`)).json()) as PendingNotification[];
    if (!Array.isArray(pending) || pending.length === 0) return Response.json({ sent: 0 });
    const users = [...new Set(pending.map((n) => n.user_id))];
    const tokens = (await (await rest(`push_tokens?user_id=in.(${users.join(',')})&select=token,user_id`)).json()) as { token: string; user_id: string }[];
    const byUser = new Map<string, string[]>();
    for (const t of tokens) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t.token]);

    // Mark first so a slow run can't send twice; notifications without phones are marked too.
    await rest(`notifications?id=in.(${pending.map((n) => n.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ push_sent_at: new Date().toISOString() }), headers: { prefer: 'return=minimal' } });

    const messages = buildPushMessages(pending, byUser);
    const dead: string[] = [];
    for (const batch of chunk(messages)) {
      const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(batch) });
      if (!res.ok) {
        console.error('push-dispatch: Expo returned', res.status);
        continue;
      }
      const body = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      dead.push(...deadTokens(batch, body.data ?? []));
    }
    if (dead.length) await rest(`push_tokens?token=in.(${dead.map((t) => `"${t}"`).join(',')})`, { method: 'DELETE' });
    return Response.json({ sent: messages.length, removed: dead.length });
  } catch (err) {
    console.error('push-dispatch failed', err instanceof Error ? err.message : 'unknown');
    return new Response('error', { status: 500 });
  }
});
