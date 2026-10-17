import { filterEvents, localDateKey, sortEvents, type CalendarEvent } from '@runlime/shared/events';
import type { RaceFilters } from '@/components/FilterSheet';

export interface RaceQuery {
  filters: RaceFilters;
  text: string;
  near: { lat: number; lng: number; radiusKm: number } | null;
  /** A tapped calendar day: show that day's races (past ones too). Otherwise upcoming races from today. */
  day: string | null;
  today: string;
}

/** Races for the Home list, in order (by distance when "Near me" is on, else by start time). */
export function selectRaces(events: CalendarEvent[], q: RaceQuery): CalendarEvent[] {
  const list = filterEvents(events, {
    from: q.day ?? q.today,
    to: q.day ?? undefined,
    regionIds: q.filters.regionIds,
    distanceKm: q.filters.distanceKm,
    maxFee: q.filters.freeOnly ? 0 : undefined,
    cause: q.filters.cause,
    walkFriendly: q.filters.walkFriendly,
    text: q.text,
    near: q.near ?? undefined,
  });
  return sortEvents(list, q.near ?? undefined);
}

export type DayStatus = 'scheduled' | 'postponed' | 'cancelled';
export interface DayMark {
  count: number;
  /** scheduled if any race that day goes ahead; else postponed if any is postponed; else cancelled. */
  status: DayStatus;
  postponed: number;
  cancelled: number;
}

/** Race marks per local day for the month view (filters apply; the day/date window does not). */
export function raceDayMarks(events: CalendarEvent[], q: Omit<RaceQuery, 'day' | 'today'>): Map<string, DayMark> {
  const list = filterEvents(events, {
    regionIds: q.filters.regionIds,
    distanceKm: q.filters.distanceKm,
    maxFee: q.filters.freeOnly ? 0 : undefined,
    cause: q.filters.cause,
    walkFriendly: q.filters.walkFriendly,
    text: q.text,
    near: q.near ?? undefined,
  });
  const out = new Map<string, DayMark>();
  for (const e of list) {
    const k = localDateKey(e.starts_at, e.timezone);
    const m = out.get(k) ?? { count: 0, status: 'cancelled' as DayStatus, postponed: 0, cancelled: 0 };
    m.count += 1;
    if (e.status === 'postponed') m.postponed += 1;
    else if (e.status === 'cancelled') m.cancelled += 1;
    out.set(k, m);
  }
  for (const m of out.values()) m.status = m.count > m.postponed + m.cancelled ? 'scheduled' : m.postponed > 0 ? 'postponed' : 'cancelled';
  return out;
}
