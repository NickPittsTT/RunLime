import { describe, expect, it } from 'vitest';
import { MAP_ATTRIBUTION, MAP_ATTRIBUTION_LINKS, addMonths, eventsByDay, feeLabel, filterEvents, haversineKm, localDateKey, monthGrid, parseCalendarEvents, sortEvents, type CalendarEvent } from '../src/events';
import { eventInputSchema, raceSuggestionSchema, isoToZonedLocal, parseGpx, toSaveEventPayload, zonedLocalToIso } from '../src/schemas/event';

const TT = 'America/Port_of_Spain';
const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'id',
  slug: 's',
  name: 'Savannah 5K',
  starts_at: '2031-03-01T10:00:00.000Z',
  timezone: TT,
  status: 'published',
  listing_source: 'organiser',
  region_id: 'r1',
  venue_name: 'Queen’s Park Savannah',
  start_lat: 10.67,
  start_lng: -61.51,
  walk_friendly: false,
  fee_min: 100,
  fee_max: null,
  currency: 'TTD',
  cause: null,
  distances: [{ distance_km: 5, label: '5K' }],
  ...over,
});

describe('time zones', () => {
  it('converts TT wall-clock time to an instant (UTC-4, no DST)', () => {
    expect(zonedLocalToIso('2031-03-01T06:00', TT)).toBe('2031-03-01T10:00:00.000Z');
    expect(isoToZonedLocal('2031-03-01T10:00:00.000Z', TT)).toBe('2031-03-01T06:00');
  });
  it('handles DST zones too (New York, summer)', () => {
    expect(zonedLocalToIso('2031-07-01T06:00', 'America/New_York')).toBe('2031-07-01T10:00:00.000Z');
  });
  it('a 9pm race on the 31st belongs to the 31st locally, not the next UTC day', () => {
    expect(localDateKey('2031-12-01T01:00:00.000Z', TT)).toBe('2031-11-30');
  });
});

describe('month grid', () => {
  it('starts on Monday and covers whole weeks', () => {
    const weeks = monthGrid(2031, 3); // March 2031 starts on a Saturday
    expect(weeks[0]![0]!.key).toBe('2031-02-24');
    expect(weeks[0]![5]!).toMatchObject({ key: '2031-03-01', inMonth: true });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(31);
  });
  it('swipes across the year boundary', () => {
    expect(addMonths({ year: 2031, month: 12 }, 1)).toEqual({ year: 2032, month: 1 });
    expect(addMonths({ year: 2031, month: 1 }, -1)).toEqual({ year: 2030, month: 12 });
  });
});

describe('filters', () => {
  const list = [
    ev({ id: 'a', name: 'Arima 10K', distances: [{ distance_km: 10, label: '10K' }], region_id: 'r2', fee_min: 0 }),
    ev({ id: 'b', walk_friendly: true, cause: 'Cancer research', starts_at: '2031-04-01T10:00:00.000Z' }),
    ev({ id: 'c', start_lat: 11.15, start_lng: -60.83, name: 'Pigeon Point Sunrise 5K' }),
  ];
  it('by distance, area, free, cause, walk-friendly, text and date', () => {
    expect(filterEvents(list, { distanceKm: [10] }).map((e) => e.id)).toEqual(['a']);
    expect(filterEvents(list, { regionIds: ['r2'] }).map((e) => e.id)).toEqual(['a']);
    expect(filterEvents(list, { maxFee: 0 }).map((e) => e.id)).toEqual(['a']);
    expect(filterEvents(list, { cause: true, walkFriendly: true }).map((e) => e.id)).toEqual(['b']);
    expect(filterEvents(list, { text: 'pigeon' }).map((e) => e.id)).toEqual(['c']);
    expect(filterEvents(list, { from: '2031-03-15' }).map((e) => e.id)).toEqual(['b']);
  });
  it('near me: radius and distance sort', () => {
    const pos = { lat: 10.66, lng: -61.52 }; // Port of Spain
    expect(filterEvents(list, { near: { ...pos, radiusKm: 25 } }).map((e) => e.id)).toEqual(['a', 'b']);
    expect(sortEvents(list, pos).at(-1)!.id).toBe('c');
    expect(Math.round(haversineKm(pos, { lat: 11.15, lng: -60.83 }))).toBeGreaterThan(80);
  });
  it('groups by local day and labels fees', () => {
    expect([...eventsByDay(list).keys()]).toEqual(['2031-03-01', '2031-04-01']);
    expect(feeLabel(ev({ fee_min: 0 }))).toBe('Free');
    expect(feeLabel(ev({ fee_min: 100, fee_max: 150 }))).toBe('TT$100–TT$150');
  });
});

describe('event input', () => {
  const base = {
    listingSource: 'runlime',
    name: 'Savannah 5K',
    startsLocal: '2031-03-01T06:00',
    regionId: '00000000-0000-4000-8000-000000000001',
    venueName: 'Queen’s Park Savannah',
    startLat: 10.67,
    startLng: -61.51,
    registrationUrl: 'https://example.org/register',
    distances: [{ km: 5, label: '5K' }],
  };
  it('RunLime listings need the official link; organiser events need an organisation', () => {
    expect(eventInputSchema.safeParse(base).success).toBe(true);
    expect(eventInputSchema.safeParse({ ...base, registrationUrl: '' }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...base, listingSource: 'organiser' }).success).toBe(false);
  });
  it('builds the save_event payload with the instant in UTC', () => {
    const p = toSaveEventPayload(eventInputSchema.parse(base));
    expect(p.event.starts_at).toBe('2031-03-01T10:00:00.000Z');
    expect(p.event.organisation_id).toBeNull();
  });
  it('parses GPX tracks (either attribute order) and downsamples', () => {
    const gpx = '<gpx><trk><trkseg><trkpt lat="10.1" lon="-61.1"/><trkpt lon="-61.2" lat="10.2"></trkpt><rtept lat="10.3" lon="-61.3"/></trkseg></trk></gpx>';
    expect(parseGpx(gpx)).toEqual([[-61.1, 10.1], [-61.2, 10.2], [-61.3, 10.3]]);
    expect(parseGpx(gpx, 2)).toEqual([[-61.1, 10.1], [-61.3, 10.3]]);
  });
});

describe('parseCalendarEvents', () => {
  const row = {
    id: 'a', slug: 's', name: 'N', starts_at: '2031-03-01T10:00:00+00:00', timezone: 'America/Port_of_Spain', status: 'published',
    listing_source: 'runlime', region_id: 'r', venue_name: 'V', start_lat: '10.6', start_lng: -61.5, walk_friendly: false,
    fee_min: '100.00', fee_max: null, currency: 'TTD', cause: null, distances: [{ distance_km: '5.0', label: '5K' }],
  };
  it('coerces numeric strings and drops malformed rows', () => {
    const out = parseCalendarEvents([row, { id: 'bad' }]);
    expect(out).toHaveLength(1);
    expect(out[0]!.start_lat).toBe(10.6);
    expect(out[0]!.fee_min).toBe(100);
    expect(out[0]!.distances[0]!.distance_km).toBe(5);
  });
  it('returns [] for non-arrays', () => {
    expect(parseCalendarEvents(null)).toEqual([]);
  });
});

describe('raceSuggestionSchema', () => {
  it('turns blank optional text into undefined', () => {
    const v = raceSuggestionSchema.parse({ name: 'Mayaro 5K', eventDate: '', location: '  ', url: '', notes: '' });
    expect(v).toEqual({ name: 'Mayaro 5K', eventDate: undefined, location: undefined, url: undefined, notes: undefined });
  });
});

describe('map attribution', () => {
  it('credits OpenStreetMap contributors (linking to the copyright page), OpenFreeMap and OpenMapTiles', () => {
    expect(MAP_ATTRIBUTION).toBe('OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors');
    expect(MAP_ATTRIBUTION_LINKS.find((l) => l.label.includes('OpenStreetMap'))!.url).toBe('https://www.openstreetmap.org/copyright');
  });
});
