import type { CalendarEvent } from '@runlime/shared/events';

const TT = 'America/Port_of_Spain';

/** A calendar row `daysFromNow` days ahead at 06:00 TT (10:00 UTC). */
export function race(id: string, daysFromNow: number, over: Partial<CalendarEvent> = {}): CalendarEvent {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return {
    id,
    slug: `race-${id}`,
    name: `Race ${id}`,
    starts_at: `${ymd}T10:00:00+00:00`,
    timezone: TT,
    status: 'published',
    listing_source: 'runlime',
    region_id: 'pos',
    venue_name: 'Queen\'s Park Savannah',
    start_lat: 10.67,
    start_lng: -61.51,
    walk_friendly: false,
    fee_min: 100,
    fee_max: null,
    currency: 'TTD',
    cause: null,
    distances: [{ distance_km: 5, label: '5K' }],
    ...over,
  };
}

/** Minimal chainable PostgREST query mock resolving to `result`. */
export function queryMock(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'in', 'gte', 'lt', 'or', 'order', 'limit', 'eq', 'update']) q[m] = jest.fn(() => q);
  q.upsert = jest.fn(async () => ({ data: null, error: null }));
  q.maybeSingle = jest.fn(async () => result);
  q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return q;
}
