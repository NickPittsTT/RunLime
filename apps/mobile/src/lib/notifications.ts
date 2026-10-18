import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { supabase } from './supabase';

const row = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string(),
  read_at: z.string().nullable(),
});
export type AppNotification = z.infer<typeof row>;

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.from('notifications').select('id, kind, title, body, data, created_at, read_at').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return z.array(row).parse(data ?? []);
}

export async function fetchUnreadCount(): Promise<number> {
  try {
    const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

/** Unread count for the bell; refreshed when `refreshKey` changes (e.g. on focus or pull-to-refresh). */
export function useUnreadCount(refreshKey?: unknown): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let active = true;
    void fetchUnreadCount().then((c) => active && setN(c));
    return () => {
      active = false;
    };
  }, [refreshKey]);
  return n;
}

export async function markRead(ids?: string[]): Promise<void> {
  await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null });
}

export const NOTIFICATION_TYPES = [
  { key: 'race_changes', label: 'Changes to races you’re going to', help: 'Postponed (with the new date), cancelled, back on.' },
  { key: 'reminders', label: 'Day-before reminders', help: 'For races you said Going or Maybe to.' },
  { key: 'organiser_messages', label: 'Updates from race organisers', help: 'Race updates for races you’re going to (at most 2 per race per week).' },
  { key: 'follows', label: 'Followers', help: 'Follow requests and approvals.' },
  { key: 'clubs', label: 'Clubs', help: 'Join requests (for leaders) and approvals.' },
] as const;
export type NotificationTypeKey = (typeof NOTIFICATION_TYPES)[number]['key'];
export type NotificationSettings = Record<NotificationTypeKey, boolean>;
export const DEFAULT_SETTINGS: NotificationSettings = { race_changes: true, reminders: true, organiser_messages: true, follows: true, clubs: true };

export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  const { data } = await supabase.from('notification_settings').select('race_changes, reminders, organiser_messages, follows, clubs').maybeSingle();
  return { ...DEFAULT_SETTINGS, ...((data as Partial<NotificationSettings> | null) ?? {}) };
}

export async function saveNotificationSettings(userId: string, s: NotificationSettings): Promise<{ message?: string } | null> {
  const { error } = await supabase.from('notification_settings').upsert({ user_id: userId, ...s }, { onConflict: 'user_id' });
  return error;
}

/** Where tapping a notification goes. */
export function notificationTarget(n: AppNotification): { pathname: string; params?: Record<string, string> } | null {
  const d = n.data as { event_id?: string; person_id?: string; club_id?: string };
  if (n.kind === 'follow_request') return { pathname: '/people' };
  if (d.event_id) return { pathname: '/race/[id]', params: { id: d.event_id } };
  if (d.club_id) return { pathname: '/club/[id]', params: { id: d.club_id } };
  if (d.person_id) return { pathname: '/person/[id]', params: { id: d.person_id } };
  if (n.kind === 'photo_removed') return { pathname: '/edit-profile' };
  return null;
}

export function useInbox() {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const apply = useCallback((r: AppNotification[] | null) => {
    if (r) setItems(r);
    setFailed(r === null);
    setRefreshing(false);
  }, []);
  const fetchSafe = () => fetchNotifications().catch(() => null);
  useEffect(() => {
    void fetchSafe().then(apply);
  }, [apply]);
  const reload = useCallback(async () => {
    setRefreshing(true);
    apply(await fetchSafe());
  }, [apply]);
  return { items, failed, refreshing, reload, setItems };
}
