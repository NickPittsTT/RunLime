// Builds Expo push messages from in-app notifications (no npm imports; unit-tested from packages/shared).

export interface PendingNotification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  /** Must match PUSH_CHANNEL_ID in the app (created at start; Android drops notifications for unknown channels). */
  channelId: 'race-updates';
  /** FCM high priority: delivered promptly to a locked phone (normal priority can wait for Doze maintenance windows). */
  priority: 'high';
}

/** One message per (notification × the person's phones). Text is truncated for phone banners. */
export function buildPushMessages(notifications: PendingNotification[], tokensByUser: Map<string, string[]>): ExpoMessage[] {
  const out: ExpoMessage[] = [];
  for (const n of notifications) {
    for (const to of tokensByUser.get(n.user_id) ?? []) {
      out.push({
        to,
        title: n.title.slice(0, 120),
        body: n.body.slice(0, 240),
        data: { ...n.data, kind: n.kind, notification_id: n.id },
        sound: 'default',
        channelId: 'race-updates',
        priority: 'high',
      });
    }
  }
  return out;
}

/** Expo accepts at most 100 messages per request. */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Tokens Expo says are no longer valid (app uninstalled), from a ticket list aligned with the messages sent. */
export function deadTokens(messages: ExpoMessage[], tickets: { status: string; details?: { error?: string } }[]): string[] {
  return tickets.flatMap((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i] ? [messages[i]!.to] : []));
}

export interface PushTicket {
  status: string;
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Error codes in a ticket list (for logs; never the tokens). */
export function ticketErrorCodes(tickets: PushTicket[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tickets) if (t.status === 'error') out[t.details?.error ?? 'unknown'] = (out[t.details?.error ?? 'unknown'] ?? 0) + 1;
  return out;
}

/** Ticket ids to check receipts for later, with the token each one went to. */
export function receiptsToTrack(messages: ExpoMessage[], tickets: PushTicket[]): { ticket_id: string; token: string }[] {
  return tickets.flatMap((t, i) => (t.status === 'ok' && t.id && messages[i] ? [{ ticket_id: t.id, token: messages[i]!.to }] : []));
}

/** From Expo receipts: error counts by code and tokens to drop (DeviceNotRegistered). */
export function readReceipts(
  rows: { ticket_id: string; token: string }[],
  receipts: Record<string, { status: string; details?: { error?: string } }>,
): { errors: Record<string, number>; dead: string[]; done: string[] } {
  const errors: Record<string, number> = {};
  const dead: string[] = [];
  const done: string[] = [];
  for (const r of rows) {
    const rec = receipts[r.ticket_id];
    if (!rec) continue;
    done.push(r.ticket_id);
    if (rec.status === 'error') {
      const code = rec.details?.error ?? 'unknown';
      errors[code] = (errors[code] ?? 0) + 1;
      if (code === 'DeviceNotRegistered') dead.push(r.token);
    }
  }
  return { errors, dead, done };
}
