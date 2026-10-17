import { filterEvents, localDateKey, movedFromDateKey, sortEvents, type CalendarEvent } from '@runlime/shared/events';
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
  const base = {
    regionIds: q.filters.regionIds,
    distanceKm: q.filters.distanceKm,
    maxFee: q.filters.freeOnly ? 0 : undefined,
    cause: q.filters.cause,
    walkFriendly: q.filters.walkFriendly,
    text: q.text,
    near: q.near ?? undefined,
  };
  const list = filterEvents(events, { ...base, from: q.day ?? q.today, to: q.day ?? undefined });
  // A tapped day also lists races postponed away from it (their card says "Postponed to …").
  const movedAway = q.day ? filterEvents(events, base).filter((e) => movedFromDateKey(e) === q.day && !list.includes(e)) : [];
  return sortEvents([...list, ...movedAway], q.near ?? undefined);
}

export type DayStatus = 'scheduled' | 'postponed' | 'cancelled' | 'moved';
export interface DayMark {
  /** Races on this day (their current date). */
  count: number;
  /** scheduled if any race that day goes ahead; else postponed if any is postponed; else cancelled;
   *  'moved' when the day only has races postponed away from it (original date, shown struck through). */
  status: DayStatus;
  postponed: number;
  cancelled: number;
  /** Races postponed from this day to a new date. */
  movedFrom: number;
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
  const mark = (k: string) => out.get(k) ?? { count: 0, status: 'cancelled' as DayStatus, postponed: 0, cancelled: 0, movedFrom: 0 };
  for (const e of list) {
    const k = localDateKey(e.starts_at, e.timezone);
    const m = mark(k);
    m.count += 1;
    if (e.status === 'postponed') m.postponed += 1;
    else if (e.status === 'cancelled') m.cancelled += 1;
    out.set(k, m);
    const from = e.status === 'postponed' ? movedFromDateKey(e) : null;
    if (from) {
      const fm = mark(from);
      fm.movedFrom += 1;
      out.set(from, fm);
    }
  }
  for (const m of out.values()) {
    m.status = m.count === 0 ? 'moved' : m.count > m.postponed + m.cancelled ? 'scheduled' : m.postponed > 0 ? 'postponed' : 'cancelled';
  }
  return out;
}
