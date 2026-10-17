import { NO_FILTERS } from '../src/components/FilterSheet';
import { initials } from '../src/components/SideMenu';
import { raceDayMarks, selectRaces } from '../src/lib/raceQuery';
import { race } from '../test-utils/races';

const TT = 'America/Port_of_Spain';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

describe('home race list', () => {
  const events = [
    race('past', -3),
    race('soon', 2, { name: 'Savannah 5K' }),
    race('later', 9, { region_id: 'sando', start_lat: 10.28, start_lng: -61.46, fee_min: 0, distances: [{ distance_km: 10, label: '10K' }] }),
    race('off', 4, { status: 'cancelled' }),
  ];
  const base = { filters: NO_FILTERS, text: '', near: null, day: null, today };

  it('shows upcoming races from today in time order (past races hidden)', () => {
    expect(selectRaces(events, base).map((e) => e.id)).toEqual(['soon', 'off', 'later']);
  });
  it('shows one day, including a past day, when a day is tapped', () => {
    const pastDay = events[0]!.starts_at.slice(0, 10);
    expect(selectRaces(events, { ...base, day: pastDay }).map((e) => e.id)).toEqual(['past']);
  });
  it('applies area, distance, free and search filters', () => {
    expect(selectRaces(events, { ...base, filters: { ...NO_FILTERS, regionIds: ['sando'] } }).map((e) => e.id)).toEqual(['later']);
    expect(selectRaces(events, { ...base, filters: { ...NO_FILTERS, distanceKm: [10] } }).map((e) => e.id)).toEqual(['later']);
    expect(selectRaces(events, { ...base, filters: { ...NO_FILTERS, freeOnly: true } }).map((e) => e.id)).toEqual(['later']);
    expect(selectRaces(events, { ...base, text: 'savannah 5k' }).map((e) => e.id)).toEqual(['soon']);
  });
  it('near me keeps races inside the radius, nearest first', () => {
    const near = { lat: 10.27, lng: -61.46, radiusKm: 25 }; // San Fernando
    expect(selectRaces(events, { ...base, near }).map((e) => e.id)).toEqual(['later']);
    expect(selectRaces(events, { ...base, near: { ...near, radiusKm: 100 } })[0]!.id).toBe('later');
  });
  it('marks race days with their status (cancelled days stay visible, marked cancelled)', () => {
    const marks = raceDayMarks(events, { filters: NO_FILTERS, text: '', near: null });
    expect(marks.get(events[1]!.starts_at.slice(0, 10))).toMatchObject({ count: 1, status: 'scheduled' });
    expect(marks.get(events[3]!.starts_at.slice(0, 10))).toMatchObject({ count: 1, status: 'cancelled', cancelled: 1 });
  });

  it('a day with one race going ahead and one postponed counts as a race day', () => {
    const a = race('a', 6);
    const b = race('b', 6, { status: 'postponed' });
    const m = raceDayMarks([a, b], { filters: NO_FILTERS, text: '', near: null }).get(a.starts_at.slice(0, 10))!;
    expect(m).toMatchObject({ count: 2, status: 'scheduled', postponed: 1 });
  });

  it('fun walk / under 5K filter', () => {
    const walk = race('walk', 3, { distances: [{ distance_km: 3, label: '3K walk' }] });
    expect(selectRaces([...events, walk], { ...base, filters: { ...NO_FILTERS, distanceKm: [0] } }).map((e) => e.id)).toEqual(['walk']);
  });
});

describe('side menu avatar initials', () => {
  it('uses first and last initials', () => {
    expect(initials('Ana Maria Lopez')).toBe('AL');
    expect(initials(' kai ')).toBe('K');
    expect(initials('')).toBe('?');
  });
});
