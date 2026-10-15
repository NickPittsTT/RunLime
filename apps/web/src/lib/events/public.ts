import 'server-only';
import type { CalendarEvent } from '@runlime/shared/events';
import { zonedLocalToIso } from '@runlime/shared/events';
import { createClient } from '@/lib/supabase/server';

const COLUMNS =
  'id, slug, name, starts_at, timezone, status, listing_source, region_id, venue_name, start_lat, start_lng, walk_friendly, fee_min, fee_max, currency, cause, distances:event_distances(distance_km, label)';

/** Public calendar events (published, postponed, cancelled) between two instants. RLS limits rows to public ones. */
export async function fetchPublicEvents(fromIso: string, toIso: string): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select(COLUMNS)
    .in('status', ['published', 'postponed', 'cancelled'])
    .gte('starts_at', fromIso)
    .lt('starts_at', toIso)
    .order('starts_at')
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as CalendarEvent[];
}

/** From the start of today (TT) to `days` ahead. */
export function upcomingWindow(days: number, timeZone = 'America/Port_of_Spain'): { from: string; to: string } {
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const from = zonedLocalToIso(`${today}T00:00`, timeZone);
  return { from, to: new Date(now.getTime() + days * 86400000).toISOString() };
}
