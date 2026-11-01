// Android UI check (evidence only): prints the text on the emulator screen (uiautomator dump), one line per
// element, so a failed step can be read from the log without the screenshot. Test accounts only.
import { execFileSync } from 'node:child_process';

const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
try {
  adb('shell', 'uiautomator', 'dump', '/sdcard/screen.xml');
  const xml = adb('shell', 'cat', '/sdcard/screen.xml');
  const texts = [...xml.matchAll(/(?:text|content-desc)="([^"]+)"/g)].map((m) => m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')).filter((t, i, a) => a.indexOf(t) === i);
  console.log(`--- screen text (${texts.length} items)`);
  for (const t of texts.slice(0, 60)) console.log(`  ${t.slice(0, 160)}`);
} catch (e) {
  console.log(`--- screen text unavailable: ${e.message.split('\n')[0]}`);
}
