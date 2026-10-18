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
  channelId: 'default';
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
        channelId: 'default',
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
