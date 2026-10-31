// Phase 4 (GPS check-in + venue search) and Phase 5 (run tracking) helpers shared by app, website and tests.

/** Great-circle distance in metres (same formula as public.distance_m in the database). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ---------------------------------------------------------------------------
// Venue search (Nominatim). OSMF usage policy: an identifying User-Agent, at most 1 request per second for the whole
// app, no type-ahead (a Search button only), cache results, show "© OpenStreetMap contributors".
// ---------------------------------------------------------------------------
export type GeocodePrecision = 'exact' | 'street' | 'town';
export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  precision: GeocodePrecision;
}

export const NOMINATIM_ATTRIBUTION = 'Search by Nominatim · © OpenStreetMap contributors';

/** Search URL for the public Nominatim server, limited to the race's country. */
export function nominatimSearchUrl(query: string, countryCode = 'tt', base = 'https://nominatim.openstreetmap.org'): string {
  const q = new URLSearchParams({ q: query.trim(), format: 'jsonv2', countrycodes: countryCode.toLowerCase(), limit: '5', addressdetails: '0' });
  return `${base}/search?${q.toString()}`;
}

const STREET = new Set(['road', 'street', 'highway', 'residential', 'primary', 'secondary', 'tertiary', 'trunk', 'unclassified', 'service', 'pedestrian', 'footway', 'path', 'track']);
const TOWN = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'quarter', 'borough', 'municipality', 'county', 'state', 'region', 'country', 'island', 'administrative', 'locality', 'district']);

/** How precise a Nominatim hit is: a place (exact), a street, or only a town/area (forces manual pin placement). */
export function precisionOf(hit: { addresstype?: string; type?: string; category?: string; class?: string }): GeocodePrecision {
  const kinds = [hit.addresstype, hit.type].filter(Boolean).map((k) => String(k).toLowerCase());
  if (kinds.some((k) => TOWN.has(k)) || (hit.category ?? hit.class) === 'boundary' || (hit.category ?? hit.class) === 'place') return 'town';
  if (kinds.some((k) => STREET.has(k)) || (hit.category ?? hit.class) === 'highway') return 'street';
  return 'exact';
}

/** Parses Nominatim jsonv2 search results (invalid entries dropped). */
export function parseNominatim(json: unknown): GeocodeResult[] {
  if (!Array.isArray(json)) return [];
  return json.slice(0, 5).flatMap((h) => {
    const lat = Number(h?.lat);
    const lng = Number(h?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || typeof h?.display_name !== 'string') return [];
    return [{ label: h.display_name.slice(0, 200), lat, lng, precision: precisionOf(h) }];
  });
}

export const PRECISION_LABEL: Record<GeocodePrecision, string> = {
  exact: 'Exact place',
  street: 'Street only: move the pin to the start line',
  town: 'Town only: place the pin yourself',
};

/** True when the pin is further than the warning distance from what the venue search found. */
export function pinFarFromAddress(pin: { lat: number; lng: number }, found: { lat: number; lng: number }, warnM = 1000): boolean {
  return distanceM(pin.lat, pin.lng, found.lat, found.lng) > warnM;
}
