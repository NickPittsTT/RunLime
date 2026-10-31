// Phase 5 run tracker maths (shared by the app and tests). Pure functions only; no I/O.
import { distanceM } from '../location';

export interface TrackPoint {
  /** epoch ms */
  t: number;
  lat: number;
  lng: number;
  /** reported horizontal accuracy in metres */
  acc: number | null;
}

/**
 * Location sampling (owner: "sensible battery settings"): GPS at "High" accuracy, one fix every 2 s or 5 m, whichever
 * comes later. Enough detail for a running route and splits without the battery cost of continuous navigation-grade
 * fixes; the foreground service stops the moment the run is stopped.
 */
export const SAMPLING = { timeIntervalMs: 2000, distanceIntervalM: 5 } as const;

/**
 * Bad-point rule: drop a fix if its reported accuracy is worse than 30 m, if its time is not after the last kept fix,
 * or if reaching it from the last kept fix would need more than 12 m/s (43 km/h, impossible on foot): GPS jumps.
 */
export const FILTER = { maxAccuracyM: 30, maxSpeedMps: 12 } as const;

export function keepPoint(prev: TrackPoint | null, p: TrackPoint, opts: { maxAccuracyM: number; maxSpeedMps: number } = FILTER): boolean {
  if (p.acc !== null && p.acc > opts.maxAccuracyM) return false;
  if (!prev) return true;
  if (p.t <= prev.t) return false;
  const v = distanceM(prev.lat, prev.lng, p.lat, p.lng) / ((p.t - prev.t) / 1000);
  return v <= opts.maxSpeedMps;
}

/** Auto-pause (on by default; the runner can turn it off): pause after 10 s below 0.5 m/s, resume above 1.0 m/s. */
export const AUTO_PAUSE = { pauseBelowMps: 0.5, resumeAboveMps: 1.0, afterMs: 10_000 } as const;

export interface RunSummary {
  distanceM: number;
  movingS: number;
  elapsedS: number;
  /** null until 100 m have been covered */
  avgPaceSPerKm: number | null;
  /** seconds per completed km (moving time) */
  splits: number[];
  /** kept points (the route) */
  route: TrackPoint[];
  autoPaused: boolean;
}

/**
 * Builds the run from raw fixes. Manual pauses are [startMs, endMs] ranges: no distance or moving time inside them,
 * and the line is broken across them. With auto-pause, slow stretches add neither distance nor moving time.
 */
export function summarise(raw: TrackPoint[], opts: { startedAt: number; now: number; pauses?: [number, number][]; autoPause?: boolean }): RunSummary {
  const pauses = opts.pauses ?? [];
  const inPause = (t: number) => pauses.some(([a, b]) => t >= a && t <= b);
  const route: TrackPoint[] = [];
  for (const p of raw) if (keepPoint(route[route.length - 1] ?? null, p)) route.push(p);

  let distance = 0;
  let moving = 0;
  const splits: number[] = [];
  let nextKm = 1000;
  let movingAtLastSplit = 0;
  let slowSince: number | null = null;
  let autoPaused = false;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!;
    const b = route[i]!;
    if (inPause(a.t) || inPause(b.t)) continue;
    const d = distanceM(a.lat, a.lng, b.lat, b.lng);
    const dt = (b.t - a.t) / 1000;
    const v = d / dt;
    if (opts.autoPause !== false) {
      if (autoPaused) {
        if (v > AUTO_PAUSE.resumeAboveMps) {
          autoPaused = false;
          slowSince = null;
        } else continue;
      } else if (v < AUTO_PAUSE.pauseBelowMps) {
        slowSince ??= a.t;
        if (b.t - slowSince >= AUTO_PAUSE.afterMs) {
          autoPaused = true;
          continue;
        }
      } else slowSince = null;
    }
    distance += d;
    moving += dt;
    while (distance >= nextKm) {
      // time at which the km boundary was crossed, interpolated inside this segment
      const over = (distance - nextKm) / d;
      const at = moving - over * dt;
      splits.push(Math.round(at - movingAtLastSplit));
      movingAtLastSplit = at;
      nextKm += 1000;
    }
  }
  const pausedMs = pauses.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, opts.now) - a), 0);
  return {
    distanceM: Math.round(distance),
    movingS: Math.round(moving),
    elapsedS: Math.max(0, Math.round((opts.now - opts.startedAt - pausedMs) / 1000)),
    avgPaceSPerKm: distance >= 100 ? Math.round(moving / (distance / 1000)) : null,
    splits,
    route,
    autoPaused,
  };
}

export function formatPace(sPerKm: number | null): string {
  if (sPerKm === null || !Number.isFinite(sPerKm)) return '–:–';
  const m = Math.floor(sPerKm / 60);
  const s = Math.round(sPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = Math.floor(totalS % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Calories: MET × body weight (kg) × hours, with the running MET for the average speed (Compendium of Physical
 * Activities). Body weight is stored on the phone only; without it, a general estimate for a 70 kg adult, labelled.
 */
export const GENERAL_ESTIMATE_KG = 70;
export function metForSpeed(kmh: number): number {
  const table: [number, number][] = [[6.4, 6.0], [8.0, 8.3], [9.7, 9.8], [11.3, 11.0], [12.9, 11.8], [14.5, 12.8], [16.1, 14.5], [17.7, 16.0], [19.3, 19.0]];
  if (kmh < 6.4) return 3.5; // brisk walk
  let met = table[0]![1];
  for (const [speed, m] of table) if (kmh >= speed) met = m;
  return met;
}
export function estimateCalories(distanceM: number, movingS: number, weightKg: number | null): { kcal: number; basis: 'weight' | 'general' } {
  if (movingS <= 0 || distanceM <= 0) return { kcal: 0, basis: weightKg ? 'weight' : 'general' };
  const kmh = distanceM / 1000 / (movingS / 3600);
  const kg = weightKg && weightKg >= 30 && weightKg <= 250 ? weightKg : null;
  return { kcal: Math.round(metForSpeed(kmh) * (kg ?? GENERAL_ESTIMATE_KG) * (movingS / 3600)), basis: kg ? 'weight' : 'general' };
}

// Google encoded polyline (precision 5): compact route storage.
export function encodePolyline(points: { lat: number; lng: number }[]): string {
  let out = '';
  let pl = 0;
  let pg = 0;
  const enc = (v: number) => {
    let s = v < 0 ? ~(v << 1) : v << 1;
    while (s >= 0x20) {
      out += String.fromCharCode((0x20 | (s & 0x1f)) + 63);
      s >>= 5;
    }
    out += String.fromCharCode(s + 63);
  };
  for (const p of points) {
    const la = Math.round(p.lat * 1e5);
    const lo = Math.round(p.lng * 1e5);
    enc(la - pl);
    enc(lo - pg);
    pl = la;
    pg = lo;
  }
  return out;
}
export function decodePolyline(str: string): { lat: number; lng: number }[] {
  const pts: { lat: number; lng: number }[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const dec = () => {
    let r = 0;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(i++) - 63;
      r |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < str.length) {
    lat += dec();
    lng += dec();
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pts;
}

/** GPX 1.1 for one run (export per run). Times only when the points carry them. */
export function toGpx(run: { name: string; startedAt: string; points: { lat: number; lng: number; t?: number }[] }): string {
  const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
  const pts = run.points
    .map((p) => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">${p.t ? `<time>${new Date(p.t).toISOString()}</time>` : ''}</trkpt>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunLime" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(run.name)}</name><time>${run.startedAt}</time></metadata>
  <trk>
    <name>${esc(run.name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

/**
 * Privacy zone (owner): if a route is ever shown to anyone else, hide the first and last `metres` (setting
 * runs.privacy_zone_m, 200) so a home or workplace can't be read from it. Returns the visible middle part (may be empty).
 */
export function privacyTrim<T extends { lat: number; lng: number }>(points: T[], metres = 200): T[] {
  if (points.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1]! + distanceM(points[i - 1]!.lat, points[i - 1]!.lng, points[i]!.lat, points[i]!.lng));
  const total = cum[cum.length - 1]!;
  if (total <= 2 * metres) return [];
  return points.filter((_, i) => cum[i]! >= metres && cum[i]! <= total - metres);
}

export interface RunTotals {
  runs: number;
  distanceM: number;
  movingS: number;
}
export function totalsOf(runs: { distance_m: number; moving_seconds: number }[]): RunTotals {
  return runs.reduce((t, r) => ({ runs: t.runs + 1, distanceM: t.distanceM + r.distance_m, movingS: t.movingS + r.moving_seconds }), { runs: 0, distanceM: 0, movingS: 0 });
}
