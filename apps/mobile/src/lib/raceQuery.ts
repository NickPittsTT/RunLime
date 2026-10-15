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

/** Race counts per local day, for marking the month view (filters apply; the day/date window does not). */
export function raceDayCounts(events: CalendarEvent[], q: Omit<RaceQuery, 'day' | 'today'>): Map<string, number> {
  const list = filterEvents(events, {
    regionIds: q.filters.regionIds,
    distanceKm: q.filters.distanceKm,
    maxFee: q.filters.freeOnly ? 0 : undefined,
    cause: q.filters.cause,
    walkFriendly: q.filters.walkFriendly,
    text: q.text,
    near: q.near ?? undefined,
  });
  const out = new Map<string, number>();
  for (const e of list) {
    if (e.status === 'cancelled') continue;
    const k = localDateKey(e.starts_at, e.timezone);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}
