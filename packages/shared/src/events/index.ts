/**
 * Race calendar helpers shared by the web portal and the mobile app.
 * All calendar dates are computed in the event's IANA time zone (America/Port_of_Spain for TT).
 */

import { z } from 'zod';

export { isoToZonedLocal, parseGpx, zonedLocalToIso } from './time';

export interface CalendarEvent {
  id: string;
  slug: string;
  name: string;
  starts_at: string;
  timezone: string;
  status: string;
  status_reason?: string | null;
  listing_source: 'organiser' | 'runlime';
  region_id: string;
  venue_name: string;
  start_lat: number;
  start_lng: number;
  walk_friendly: boolean;
  fee_min: number;
  fee_max: number | null;
  currency: string;
  cause: string | null;
  distances: { distance_km: number; label: string }[];
}

/** Columns for calendar rows (web + mobile select the same shape). */
export const CALENDAR_COLUMNS =
  'id, slug, name, starts_at, timezone, status, status_reason, listing_source, region_id, venue_name, start_lat, start_lng, walk_friendly, fee_min, fee_max, currency, cause, distances:event_distances(distance_km, label)';

/** Validates calendar rows from the API (numeric columns may arrive as strings). */
export const calendarEventSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  starts_at: z.string(),
  timezone: z.string(),
  status: z.string(),
  status_reason: z.string().nullable().optional(),
  listing_source: z.enum(['organiser', 'runlime']),
  region_id: z.string(),
  venue_name: z.string(),
  start_lat: z.coerce.number(),
  start_lng: z.coerce.number(),
  walk_friendly: z.boolean(),
  fee_min: z.coerce.number(),
  fee_max: z.coerce.number().nullable(),
  currency: z.string(),
  cause: z.string().nullable(),
  distances: z.array(z.object({ distance_km: z.coerce.number(), label: z.string() })),
});

/** Parse rows, dropping (not throwing on) any that do not match. */
export function parseCalendarEvents(rows: unknown): CalendarEvent[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    const p = calendarEventSchema.safeParse(r);
    return p.success ? [p.data] : [];
  });
}

/** "YYYY-MM-DD" of an instant in a zone. */
export function localDateKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Today's "YYYY-MM-DD" in a zone. */
export function todayKey(timeZone: string, now: Date = new Date()): string {
  return localDateKey(now.toISOString(), timeZone);
}

export interface MonthCell {
  key: string; // YYYY-MM-DD
  day: number;
  inMonth: boolean;
}

/** Weeks (Monday first) covering a month: 4–6 rows of 7 cells. */
export function monthGrid(year: number, month: number): MonthCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysIn = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const cells: MonthCell[] = [];
  for (let i = -lead; cells.length < Math.ceil((lead + daysIn) / 7) * 7; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 + i));
    cells.push({
      key: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month - 1,
    });
  }
  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Move a {year, month} by n months. */
export function addMonths(ym: { year: number; month: number }, n: number): { year: number; month: number } {
  const idx = ym.year * 12 + (ym.month - 1) + n;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function monthLabel(year: number, month: number, locale = 'en-TT'): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Events grouped by local date key. */
export function eventsByDay<T extends Pick<CalendarEvent, 'starts_at' | 'timezone'>>(events: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const e of events) {
    const k = localDateKey(e.starts_at, e.timezone);
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  return map;
}

export function formatEventDate(iso: string, timeZone: string, locale = 'en-TT'): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(new Date(iso));
}
export function formatEventTime(iso: string, timeZone: string, locale = 'en-TT'): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso));
}

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface EventFilters {
  from?: string; // YYYY-MM-DD (inclusive, local)
  to?: string; // YYYY-MM-DD (inclusive, local)
  regionIds?: string[];
  distanceKm?: number[]; // match any distance within ±0.5 km; FUN_WALK_KM (0) = any distance under 5 km
  maxFee?: number; // 0 = free only
  cause?: boolean; // charity / cause races only
  walkFriendly?: boolean;
  text?: string;
  near?: { lat: number; lng: number; radiusKm: number };
}

/** Distance choice meaning "Fun walk / under 5K": matches any race distance shorter than 5 km. */
export const FUN_WALK_KM = 0;

export function distanceMatches(raceKm: number, choiceKm: number): boolean {
  return choiceKm === FUN_WALK_KM ? raceKm < 5 : Math.abs(raceKm - choiceKm) <= 0.5;
}

/** Distance filter choices (app onboarding + filters; web /races). */
export const DISTANCE_CHOICES = [
  { km: FUN_WALK_KM, label: 'Fun walk / under 5K' },
  { km: 5, label: '5K' },
  { km: 10, label: '10K' },
  { km: 21.1, label: 'Half marathon' },
  { km: 42.2, label: 'Marathon' },
] as const;

export function filterEvents<T extends CalendarEvent>(events: T[], f: EventFilters): T[] {
  const text = f.text?.trim().toLowerCase();
  return events.filter((e) => {
    const k = localDateKey(e.starts_at, e.timezone);
    if (f.from && k < f.from) return false;
    if (f.to && k > f.to) return false;
    if (f.regionIds?.length && !f.regionIds.includes(e.region_id)) return false;
    if (f.distanceKm?.length && !e.distances.some((d) => f.distanceKm!.some((km) => distanceMatches(Number(d.distance_km), km)))) return false;
    if (f.maxFee !== undefined && Number(e.fee_min) > f.maxFee) return false;
    if (f.cause && !e.cause) return false;
    if (f.walkFriendly && !e.walk_friendly) return false;
    if (text && !`${e.name} ${e.venue_name}`.toLowerCase().includes(text)) return false;
    if (f.near && haversineKm(f.near, { lat: e.start_lat, lng: e.start_lng }) > f.near.radiusKm) return false;
    return true;
  });
}

/** Sort by start time; with a location, by distance then time. */
export function sortEvents<T extends CalendarEvent>(events: T[], near?: { lat: number; lng: number }): T[] {
  const copy = [...events];
  if (near) {
    return copy.sort(
      (a, b) =>
        haversineKm(near, { lat: a.start_lat, lng: a.start_lng }) - haversineKm(near, { lat: b.start_lat, lng: b.start_lng }) ||
        a.starts_at.localeCompare(b.starts_at),
    );
  }
  return copy.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function feeLabel(e: Pick<CalendarEvent, 'fee_min' | 'fee_max' | 'currency'>): string {
  const min = Number(e.fee_min);
  const max = e.fee_max === null ? null : Number(e.fee_max);
  if (min === 0 && (max === null || max === 0)) return 'Free';
  const money = (n: number) => `${e.currency === 'TTD' ? 'TT$' : `${e.currency} `}${n % 1 === 0 ? n : n.toFixed(2)}`;
  return max !== null && max > min ? `${money(min)}–${money(max)}` : money(min);
}

export const STATUS_LABEL: Record<string, string> = {
  published: 'Scheduled',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
  pending_approval: 'Waiting for approval',
  draft: 'Draft',
  rejected: 'Not approved',
  unpublished: 'Unpublished',
};

/** OpenFreeMap vector style (free, no key). Used by MapLibre on web and mobile. */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
/**
 * Map credit required by the OpenStreetMap licence (ODbL) and OpenFreeMap / OpenMapTiles.
 * Shown as visible text on every map, web and app (not hidden behind an "i" button).
 */
export const MAP_ATTRIBUTION_LINKS = [
  { label: 'OpenFreeMap', url: 'https://openfreemap.org' },
  { label: '© OpenMapTiles', url: 'https://www.openmaptiles.org/' },
  { label: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' },
] as const;
export const MAP_ATTRIBUTION = MAP_ATTRIBUTION_LINKS.map((l) => l.label).join(' · ');
/** Default map centre for TT. */
export const TT_CENTER = { lat: 10.45, lng: -61.3 };
