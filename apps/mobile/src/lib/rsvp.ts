import type { RsvpStatus } from '@runlime/shared/community';
import { CALENDAR_COLUMNS, parseCalendarEvents, type CalendarEvent } from '@runlime/shared/events';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { supabase } from './supabase';

export interface MyRsvp {
  status: RsvpStatus;
  adults: number;
  children: number;
}
const rsvpRow = z.object({ status: z.enum(['going', 'maybe', 'not_going']), adults: z.coerce.number(), children: z.coerce.number() });

export type Counts = Map<string, { going: number; maybe: number }>;

/** Public "N going" (adults, incl. groups) and "N maybe" per race. Children are never counted publicly. */
export async function fetchRsvpCounts(ids: string[]): Promise<Counts> {
  const out: Counts = new Map();
  if (ids.length === 0) return out;
  try {
    const { data, error } = await supabase.rpc('rsvp_counts', { p_events: ids });
    if (error || !Array.isArray(data)) return out;
    for (const r of data as { event_id: string; going: number; maybe: number }[]) out.set(r.event_id, { going: Number(r.going), maybe: Number(r.maybe) });
  } catch {
    // Offline: counts are optional; the calendar still works without them.
  }
  return out;
}

/** Counts for the races on screen; refetched when the list or `refreshKey` changes. */
export function useRsvpCounts(ids: string[], refreshKey?: unknown): Counts {
  const [counts, setCounts] = useState<Counts>(new Map());
  const key = ids.join(',');
  useEffect(() => {
    let active = true;
    void fetchRsvpCounts(key ? key.split(',') : []).then((c) => {
      if (active) setCounts(c);
    });
    return () => {
      active = false;
    };
  }, [key, refreshKey]);
  return counts;
}

export async function fetchMyRsvp(eventId: string): Promise<MyRsvp | null> {
  try {
    const { data } = await supabase.from('rsvps').select('status, adults, children').eq('event_id', eventId).maybeSingle();
    const p = rsvpRow.safeParse(data);
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

export async function saveRsvp(eventId: string, r: MyRsvp): Promise<{ message?: string; code?: string } | null> {
  const { error } = await supabase.rpc('set_rsvp', { p_event: eventId, p_status: r.status, p_adults: r.adults, p_children: r.children });
  return error;
}

export interface MyRace {
  rsvp: MyRsvp;
  event: CalendarEvent;
}

/** M20 "My races": your Going / Maybe races, upcoming first, then past ones. */
export async function fetchMyRaces(): Promise<MyRace[]> {
  const { data, error } = await supabase
    .from('rsvps')
    .select(`status, adults, children, events(${CALENDAR_COLUMNS})`)
    .in('status', ['going', 'maybe']);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { status: string; adults: number; children: number; events: unknown }[];
  return rows.flatMap((r) => {
    const rsvp = rsvpRow.safeParse(r);
    const [event] = parseCalendarEvents([r.events]);
    return rsvp.success && event ? [{ rsvp: rsvp.data, event }] : [];
  });
}

export function useMyRaces() {
  const [races, setRaces] = useState<MyRace[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const apply = useCallback((r: MyRace[] | null) => {
    if (r) setRaces(r);
    setFailed(r === null);
    setRefreshing(false);
  }, []);
  const fetchSafe = () => fetchMyRaces().catch(() => null);
  useEffect(() => {
    void fetchSafe().then(apply);
  }, [apply]);
  const load = useCallback(async () => {
    setRefreshing(true);
    apply(await fetchSafe());
  }, [apply]);
  return { races, failed, refreshing, reload: load };
}
