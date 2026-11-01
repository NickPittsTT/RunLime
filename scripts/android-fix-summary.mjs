// Phase 5 emulator check (evidence only): summarises the emulator GPS fixes sampled once a second during the route
// replay: how many distinct fixes, how far apart in time and distance, and the fastest implied speed.
//   node scripts/android-fix-summary.mjs /tmp/ui/fixes.txt
import { readFileSync } from 'node:fs';

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
const dist = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const rows = readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.trim().split(/[ ,]/)).filter((p) => p.length === 3 && p[1]).map(([t, lat, lng]) => ({ t: Number(t), lat: Number(lat), lng: Number(lng) }));
const distinct = rows.filter((r, i) => i === 0 || r.lat !== rows[i - 1].lat || r.lng !== rows[i - 1].lng);
if (distinct.length < 2) {
  console.log(`INFO  emulator fixes: ${distinct.length} distinct position(s) seen in ${rows.length} samples`);
  process.exit(0);
}
let total = 0, maxV = 0, maxGapS = 0, maxStepM = 0;
for (let i = 1; i < distinct.length; i++) {
  const d = dist(distinct[i - 1], distinct[i]);
  const dt = Math.max(1, distinct[i].t - distinct[i - 1].t);
  total += d; maxV = Math.max(maxV, d / dt); maxGapS = Math.max(maxGapS, dt); maxStepM = Math.max(maxStepM, d);
}
const span = distinct[distinct.length - 1].t - distinct[0].t;
console.log(`INFO  emulator fixes: ${distinct.length} distinct positions over ${span} s; path ${Math.round(total)} m; largest step ${Math.round(maxStepM)} m; longest gap ${maxGapS} s; fastest ${maxV.toFixed(1)} m/s (the app drops points faster than 12 m/s)`);
