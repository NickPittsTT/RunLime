import 'server-only';
import type { CalendarEvent } from '@runlime/shared/events';
import { CALENDAR_COLUMNS, calendarWindowFilter, parseCalendarEvents, zonedLocalToIso } from '@runlime/shared/events';
import { createClient } from '@/lib/supabase/server';

/** Public calendar events (published, postponed, cancelled) between two instants (or postponed away from that window). RLS limits rows to public ones. */
export async function fetchPublicEvents(fromIso: string, toIso: string): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select(CALENDAR_COLUMNS)
    .in('status', ['published', 'postponed', 'cancelled'])
    .or(calendarWindowFilter(fromIso, toIso))
    .order('starts_at')
    .limit(500);
  if (error) throw error;
  return parseCalendarEvents(data);
}

/** From the start of today (TT) to `days` ahead. */
export function upcomingWindow(days: number, timeZone = 'America/Port_of_Spain'): { from: string; to: string } {
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const from = zonedLocalToIso(`${today}T00:00`, timeZone);
  return { from, to: new Date(now.getTime() + days * 86400000).toISOString() };
}
