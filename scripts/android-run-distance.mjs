// Phase 5 emulator check: reads the live run distance ("0.98 km") from the screen (uiautomator dump) and checks
// it is within the tolerance of the replayed route. Exits 1 outside it or if no distance is shown.
//   node scripts/android-run-distance.mjs <expected km> <tolerance fraction>
import { execFileSync } from 'node:child_process';

const expected = Number(process.argv[2] ?? 1);
const tol = Number(process.argv[3] ?? 0.1);
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
adb('shell', 'uiautomator', 'dump', '/sdcard/run.xml');
const xml = adb('shell', 'cat', '/sdcard/run.xml');
const values = [...xml.matchAll(/text="(\d+\.\d{2}) km"/g)].map((m) => Number(m[1]));
if (!values.length) {
  console.log('FAIL  no live distance on screen');
  process.exit(1);
}
const km = values[0];
const off = Math.abs(km - expected) / expected;
const verdict = off <= tol ? 'PASS' : 'FAIL';
console.log(`${verdict}  live distance ${km.toFixed(2)} km for a ${expected.toFixed(2)} km route (${(off * 100).toFixed(1)}% off; limit ${(tol * 100).toFixed(0)}%)`);
process.exit(verdict === 'PASS' ? 0 : 1);
