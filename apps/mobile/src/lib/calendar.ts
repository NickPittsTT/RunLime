import AsyncStorage from '@react-native-async-storage/async-storage';
import { CALENDAR_COLUMNS, parseCalendarEvents, zonedLocalToIso, type CalendarEvent } from '@runlime/shared/events';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { supabase } from './supabase';

const TT = 'America/Port_of_Spain';
export const CALENDAR_CACHE_KEY = 'runlime.calendarCache.v1';

const cacheSchema = z.object({ savedAt: z.string(), events: z.array(z.unknown()) });

/** Calendar window: 1 January this year to 31 December next year (TT dates). */
export function calendarWindow(now: Date = new Date()): { from: string; to: string; firstYear: number } {
  const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: TT, year: 'numeric' }).format(now));
  return { from: zonedLocalToIso(`${year}-01-01T00:00`, TT), to: zonedLocalToIso(`${year + 2}-01-01T00:00`, TT), firstYear: year };
}

export async function fetchCalendarEvents(now: Date = new Date()): Promise<CalendarEvent[]> {
  const { from, to } = calendarWindow(now);
  const { data, error } = await supabase
    .from('events')
    .select(CALENDAR_COLUMNS)
    .in('status', ['published', 'postponed', 'cancelled'])
    .gte('starts_at', from)
    .lt('starts_at', to)
    .order('starts_at')
    .limit(1000);
  if (error) throw error;
  return parseCalendarEvents(data);
}

export async function readCalendarCache(): Promise<{ savedAt: string; events: CalendarEvent[] } | null> {
  try {
    const raw = await AsyncStorage.getItem(CALENDAR_CACHE_KEY);
    if (!raw) return null;
    const parsed = cacheSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { savedAt: parsed.data.savedAt, events: parseCalendarEvents(parsed.data.events) } : null;
  } catch {
    return null;
  }
}

interface CalendarLoad {
  events: CalendarEvent[] | null;
  offlineSince: string | null;
  failed: boolean;
  /** When the shown races were last fetched from the server (ISO). */
  updatedAt: string | null;
}

/** Fetch the calendar and save a copy; on failure fall back to the saved copy. */
export async function loadCalendar(): Promise<CalendarLoad> {
  try {
    const fresh = await fetchCalendarEvents();
    const savedAt = new Date().toISOString();
    await AsyncStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({ savedAt, events: fresh })).catch(() => undefined);
    return { events: fresh, offlineSince: null, failed: false, updatedAt: savedAt };
  } catch {
    const cached = await readCalendarCache();
    return cached
      ? { events: cached.events, offlineSince: cached.savedAt, failed: false, updatedAt: cached.savedAt }
      : { events: null, offlineSince: null, failed: true, updatedAt: null };
  }
}

export interface CalendarState {
  events: CalendarEvent[] | null;
  /** Set when showing saved races because the latest fetch failed. */
  offlineSince: string | null;
  failed: boolean;
  /** Last successful fetch of the races shown (ISO), live or saved. */
  updatedAt: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

/** Public race calendar with an offline copy (last successful fetch, AsyncStorage). */
export function useCalendar(): CalendarState {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const apply = useCallback((r: CalendarLoad) => {
    if (r.events) setEvents(r.events);
    if (r.updatedAt) setUpdatedAt(r.updatedAt);
    setOfflineSince(r.offlineSince);
    setFailed(r.failed);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadCalendar().then(apply);
  }, [apply]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    apply(await loadCalendar());
  }, [apply]);

  return { events, offlineSince, failed, updatedAt, refreshing, refresh };
}

/** "17 Oct, 5:42 pm" in Trinidad and Tobago time. */
export function formatUpdated(iso: string): string {
  return new Intl.DateTimeFormat('en-TT', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TT }).format(new Date(iso));
}
