import { describe, expect, it } from 'vitest';
import { decodePolyline, encodePolyline, estimateCalories, formatDuration, formatPace, keepPoint, privacyTrim, summarise, toGpx, type TrackPoint } from '../src/runs';

// A straight run north at a steady speed: one fix every 2 s.
function straightRun(metres: number, speedMps: number, opts: { startT?: number; acc?: number } = {}): TrackPoint[] {
  const pts: TrackPoint[] = [];
  const dLatPerM = 1 / 111_195; // ~1 m of latitude
  const step = speedMps * 2;
  for (let d = 0, t = opts.startT ?? 0; d <= metres; d += step, t += 2000) pts.push({ t, lat: 10.6 + d * dLatPerM, lng: -61.5, acc: opts.acc ?? 5 });
  return pts;
}

describe('bad-point rule', () => {
  it('drops fixes worse than 30 m accuracy, out-of-order times, and jumps faster than 12 m/s', () => {
    const a = { t: 0, lat: 10.6, lng: -61.5, acc: 5 };
    expect(keepPoint(null, a)).toBe(true);
    expect(keepPoint(a, { ...a, t: 2000, lat: 10.60003, acc: 31 })).toBe(false); // poor accuracy
    expect(keepPoint(a, { ...a, t: 0, lat: 10.60003 })).toBe(false); // time not after
    expect(keepPoint(a, { ...a, t: 2000, lat: 10.6005 })).toBe(false); // ~55 m in 2 s = 28 m/s
    expect(keepPoint(a, { ...a, t: 2000, lat: 10.60005 })).toBe(true); // ~5.6 m in 2 s = 2.8 m/s
  });
});

describe('run summary', () => {
  it('5 km at 5:00 /km: distance, moving time, pace, 5 splits of ~300 s', () => {
    const s = summarise(straightRun(5010, 1000 / 300), { startedAt: 0, now: 1_503_000 }); // last fix just past 5 km
    expect(Math.abs(s.distanceM - 5005)).toBeLessThan(15);
    expect(Math.abs(s.movingS - 1502)).toBeLessThan(10);
    expect(Math.abs(s.avgPaceSPerKm! - 300)).toBeLessThanOrEqual(2);
    expect(s.splits).toHaveLength(5);
    for (const sp of s.splits) expect(Math.abs(sp - 300)).toBeLessThanOrEqual(2);
  });
  it('a GPS jump in the middle is ignored', () => {
    const pts = straightRun(1000, 3);
    pts.splice(100, 0, { t: pts[99]!.t + 1000, lat: 10.7, lng: -61.5, acc: 5 }); // 11 km away
    const s = summarise(pts, { startedAt: 0, now: 400_000 });
    expect(s.distanceM).toBeLessThan(1020);
  });
  it('a manual pause adds no distance or moving time, and elapsed time excludes it', () => {
    const first = straightRun(500, 3);
    const lastT = first[first.length - 1]!.t;
    // stand still 60 s (paused), then 500 m more from the same spot
    const second = straightRun(500, 3, { startT: lastT + 60_000 }).map((p) => ({ ...p, lat: p.lat + 500 / 111_195 }));
    const s = summarise([...first, ...second], { startedAt: 0, now: second[second.length - 1]!.t, pauses: [[lastT + 1, lastT + 59_999]] });
    expect(Math.abs(s.distanceM - 1000)).toBeLessThan(15);
    expect(s.elapsedS).toBeLessThan(Math.round(second[second.length - 1]!.t / 1000) - 55);
  });
  it('auto-pause: standing at a junction for a minute adds no moving time; turning it off counts it', () => {
    const run = straightRun(400, 3);
    const end = run[run.length - 1]!;
    for (let i = 1; i <= 30; i++) run.push({ ...end, t: end.t + i * 2000, lat: end.lat + (i % 2) * 0.000002 }); // ~0.1 m/s jitter
    const after = straightRun(400, 3, { startT: end.t + 62_000 }).map((p) => ({ ...p, lat: p.lat + 400 / 111_195 }));
    const all = [...run, ...after];
    const on = summarise(all, { startedAt: 0, now: all[all.length - 1]!.t });
    const off = summarise(all, { startedAt: 0, now: all[all.length - 1]!.t, autoPause: false });
    expect(off.movingS - on.movingS).toBeGreaterThan(40);
  });
});

describe('formatting, calories, storage, export, privacy', () => {
  it('formats pace and time', () => {
    expect(formatPace(305)).toBe('5:05');
    expect(formatPace(null)).toBe('–:–');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(65)).toBe('1:05');
  });
  it('calories: with a weight on the phone, or a labelled general estimate', () => {
    expect(estimateCalories(10_000, 3600, 60)).toEqual({ kcal: Math.round(9.8 * 60), basis: 'weight' }); // 10 km/h
    expect(estimateCalories(10_000, 3600, null)).toEqual({ kcal: Math.round(9.8 * 70), basis: 'general' });
  });
  it('encodes and decodes the route', () => {
    const pts = [{ lat: 10.6718, lng: -61.5146 }, { lat: 10.6731, lng: -61.5139 }, { lat: 10.6702, lng: -61.5201 }];
    const back = decodePolyline(encodePolyline(pts));
    back.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(pts[i]!.lat, 5);
      expect(p.lng).toBeCloseTo(pts[i]!.lng, 5);
    });
  });
  it('writes GPX 1.1 with escaped names', () => {
    const gpx = toGpx({ name: 'Run & <test>', startedAt: '2026-11-01T10:00:00.000Z', points: [{ lat: 10.6, lng: -61.5, t: Date.UTC(2026, 10, 1, 10) }] });
    expect(gpx).toContain('<gpx version="1.1" creator="RunLime"');
    expect(gpx).toContain('<name>Run &amp; &lt;test&gt;</name>');
    expect(gpx).toContain('<trkpt lat="10.600000" lon="-61.500000"><time>2026-11-01T10:00:00.000Z</time></trkpt>');
  });
  it('privacy zone hides the first and last 200 m', () => {
    const pts = straightRun(1000, 5).map(({ lat, lng }) => ({ lat, lng }));
    const shown = privacyTrim(pts, 200);
    const start = shown[0]!;
    const end = shown[shown.length - 1]!;
    expect((start.lat - pts[0]!.lat) * 111_195).toBeGreaterThanOrEqual(199);
    expect((pts[pts.length - 1]!.lat - end.lat) * 111_195).toBeGreaterThanOrEqual(199);
    expect(privacyTrim(straightRun(300, 5), 200)).toEqual([]); // shorter than 400 m: nothing shown
  });
});
