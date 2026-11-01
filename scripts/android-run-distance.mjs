// Phase 5 emulator check: reads the live run distance ("0.98 km") from the screen (uiautomator dump) until it is
// within the tolerance of the replayed route or the wait runs out. Location fixes reach the app's background task
// in batches, so the live number can trail the replay by several seconds (run 4: 0.06 km, then 1.00 km 3 s later).
//   node scripts/android-run-distance.mjs <expected km> <tolerance fraction> [max wait s]
import { execFileSync } from 'node:child_process';

const expected = Number(process.argv[2] ?? 1);
const tol = Number(process.argv[3] ?? 0.1);
const maxWaitS = Number(process.argv[4] ?? 40);
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const read = () => {
  adb('shell', 'uiautomator', 'dump', '/sdcard/run.xml');
  const m = adb('shell', 'cat', '/sdcard/run.xml').match(/text="(\d+\.\d{2}) km"/);
  return m ? Number(m[1]) : null;
};
const start = Date.now();
const seen = [];
let km = null;
while (true) {
  km = read();
  const s = Math.round((Date.now() - start) / 1000);
  if (km !== null) seen.push(`${km.toFixed(2)}@${s}s`);
  if (km !== null && Math.abs(km - expected) / expected <= tol) break;
  if (s >= maxWaitS) break;
  execFileSync('sleep', ['2']);
}
if (km === null) {
  console.log('FAIL  no live distance on screen');
  process.exit(1);
}
const off = Math.abs(km - expected) / expected;
const verdict = off <= tol ? 'PASS' : 'FAIL';
console.log(`${verdict}  live distance ${km.toFixed(2)} km for a ${expected.toFixed(2)} km route (${(off * 100).toFixed(1)}% off; limit ${(tol * 100).toFixed(0)}%); readings ${seen.slice(-6).join(', ')}`);
process.exit(verdict === 'PASS' ? 0 : 1);
