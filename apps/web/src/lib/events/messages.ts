import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const Allowance = z.object({
  used: z.number(),
  limit: z.number(),
  remaining: z.number(),
  race_week: z.boolean(),
  normal_limit: z.number(),
  race_week_limit: z.number(),
  admin_exempt: z.boolean(),
});
export type MessageAllowance = z.infer<typeof Allowance>;

/** Messages sent for a race and what the sender may still send (event_message_allowance: settings, race week, admin exemption). */
export async function loadMessages(supabase: SupabaseClient, eventId: string) {
  const [{ data: history }, { data: allowance, error }] = await Promise.all([
    supabase.from('event_messages').select('id, body, recipients, created_at').eq('event_id', eventId).order('created_at', { ascending: false }),
    supabase.rpc('event_message_allowance', { p_event: eventId }),
  ]);
  if (error) throw new Error(`Could not load the message allowance: ${error.message}`);
  return { history: (history ?? []) as { id: string; body: string; recipients: number; created_at: string }[], allowance: Allowance.parse(allowance) };
}
