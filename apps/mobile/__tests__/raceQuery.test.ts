import { NO_FILTERS } from '../src/components/FilterSheet';
import { initials } from '../src/components/SideMenu';
import { raceDayCounts, selectRaces } from '../src/lib/raceQuery';
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
  it('marks race days but not cancelled races', () => {
    const counts = raceDayCounts(events, { filters: NO_FILTERS, text: '', near: null });
    expect(counts.get(events[1]!.starts_at.slice(0, 10))).toBe(1);
    expect(counts.get(events[3]!.starts_at.slice(0, 10))).toBeUndefined();
  });
});

describe('side menu avatar initials', () => {
  it('uses first and last initials', () => {
    expect(initials('Ana Maria Lopez')).toBe('AL');
    expect(initials(' kai ')).toBe('K');
    expect(initials('')).toBe('?');
  });
});
