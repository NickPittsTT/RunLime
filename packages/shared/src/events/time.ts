/** Time-zone and GPX helpers (no zod: safe to import from client components without pulling in schemas). */

/**
 * Convert a wall-clock time in an IANA time zone to an ISO instant with offset.
 * Works for any zone (DST-safe for unambiguous times) without a date library.
 */
export function zonedLocalToIso(local: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error('Invalid local date-time');
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const offsetMin = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(instant));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return (Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - instant) / 60000;
  };
  // Two passes handle offsets that differ either side of a DST change.
  let instant = asUtc - offsetMin(asUtc) * 60000;
  instant = asUtc - offsetMin(instant) * 60000;
  return new Date(instant).toISOString();
}

/** The inverse: an instant shown as "YYYY-MM-DDTHH:mm" wall-clock time in the zone (for editing). */
export function isoToZonedLocal(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Parse a GPX file's track/route points into [lng, lat] pairs (simple, dependency-free). */
export function parseGpx(xml: string, maxPoints = 2000): [number, number][] {
  const pts: [number, number][] = [];
  const re = /<(?:trkpt|rtept)\b[^>]*?\blat="(-?[\d.]+)"[^>]*?\blon="(-?[\d.]+)"|<(?:trkpt|rtept)\b[^>]*?\blon="(-?[\d.]+)"[^>]*?\blat="(-?[\d.]+)"/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const lat = Number(m[1] ?? m[4]);
    const lng = Number(m[2] ?? m[3]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push([lng, lat]);
  }
  if (pts.length <= maxPoints) return pts;
  // Downsample evenly, keeping the first and last points.
  const step = (pts.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => pts[Math.round(i * step)]!);
}

