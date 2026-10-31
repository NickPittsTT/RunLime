// Android UI check: with the keyboard open, is each named element fully above the keyboard? Reads the keyboard's
// frame (dumpsys window, "type=ime ... visible=true") and the element bounds (uiautomator dump, matched by
// content-desc or text). Exits 1 if any element is covered or the keyboard is closed.
//   node scripts/android-keyboard-geometry.mjs "Tell us what happened" ["Send report" …]
import { execFileSync } from 'node:child_process';

const labels = process.argv.slice(2);
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// The keyboard's top edge, from whichever form this Android version prints: the ime insets source, or the input
// method window's touchable region.
function keyboardTopFrom(text) {
  const tops = [];
  for (const line of text.split('\n')) {
    if (/type=ime\b/.test(line) && /visible=true/.test(line)) {
      const m = line.match(/frame=\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (m && Number(m[2]) > 0) tops.push(Number(m[2]));
    }
  }
  if (tops.length) return Math.min(...tops);
  const block = text.split(/\n(?=  Window #)/).find((b) => /InputMethod\}/.test(b) && /isVisible=true|mViewVisibility=0x0\b/.test(b));
  const touch = block?.match(/touchable region=SkRegion\(\((\d+),(\d+),(\d+),(\d+)\)\)/);
  return touch && Number(touch[2]) > 0 ? Number(touch[2]) : null;
}
const shown = /mInputShown=true|mImeWindowVis=[1-9]/.test(adb('shell', 'dumpsys', 'input_method'));
const windows = adb('shell', 'dumpsys', 'window');
const keyboardTop = keyboardTopFrom(windows + '\n' + adb('shell', 'dumpsys', 'window', 'windows'));
if (!shown || keyboardTop === null) {
  console.log(`FAIL  keyboard ${shown ? 'is open but its position could not be read' : 'is not open'}`);
  if (shown) for (const l of windows.split('\n').filter((l) => /ime|InputMethod/i.test(l)).slice(0, 60)) console.log(`  dumpsys: ${l.trim().slice(0, 200)}`);
  process.exit(1);
}
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
