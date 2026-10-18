import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Messages sent for a race, how many in the last 7 days, and the weekly limit (setting). */
export async function loadMessages(supabase: SupabaseClient, eventId: string) {
  const [{ data: history }, { data: setting }] = await Promise.all([
    supabase.from('event_messages').select('id, body, recipients, created_at').eq('event_id', eventId).order('created_at', { ascending: false }),
    supabase.from('app_settings').select('value').eq('key', 'messages.per_race_per_week').maybeSingle(),
  ]);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const rows = (history ?? []) as { id: string; body: string; recipients: number; created_at: string }[];
  return { history: rows, sentThisWeek: rows.filter((m) => new Date(m.created_at).getTime() > weekAgo).length, limit: Number((setting?.value as string) ?? 2) || 2 };
}
