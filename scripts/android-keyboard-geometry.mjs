// Android UI check: with the keyboard open, is each named element fully above the keyboard? Reads the keyboard's
// frame (dumpsys window, "type=ime ... visible=true") and the element bounds (uiautomator dump, matched by
// content-desc or text). Exits 1 if any element is covered or the keyboard is closed.
//   node scripts/android-keyboard-geometry.mjs "Tell us what happened" ["Send report" …]
import { execFileSync } from 'node:child_process';

const labels = process.argv.slice(2);
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const windows = adb('shell', 'dumpsys', 'window');
const ime = [...windows.matchAll(/type=ime frame=\[(\d+),(\d+)\]\[(\d+),(\d+)\] visible=true/g)].map((m) => Number(m[2])).filter((y) => y > 0);
if (ime.length === 0) {
  console.log('FAIL  keyboard is not open (no visible ime inset in dumpsys window)');
  process.exit(1);
}
const keyboardTop = Math.min(...ime);
adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
const xml = adb('shell', 'cat', '/sdcard/ui.xml');
let failed = 0;
for (const label of labels) {
  const node = [...xml.matchAll(/<node [^>]*>/g)].map((m) => m[0]).find((n) => n.includes(`content-desc="${label}"`) || n.includes(`text="${label}"`));
  const b = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!b) {
    console.log(`FAIL  "${label}" not on screen`);
    failed++;
    continue;
  }
  const [top, bottom] = [Number(b[2]), Number(b[4])];
  const ok = bottom <= keyboardTop && top >= 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  "${label}" top ${top}px, bottom ${bottom}px; keyboard top ${keyboardTop}px${ok ? '' : ` (${bottom - keyboardTop}px under the keyboard)`}`);
}
process.exit(failed ? 1 : 0);
