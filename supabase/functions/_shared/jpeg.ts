// JPEG metadata stripping for profile photos (no npm imports; also unit-tested from packages/shared).
// Keeps only what is needed to display the image: JFIF header (APP0), tables, frame and scan data.
// Drops APP1–APP15 (EXIF incl. GPS location, XMP, ICC, maker notes, thumbnails) and comments (COM).

export interface StrippedJpeg {
  bytes: Uint8Array;
  width: number;
  height: number;
}

const SOI = 0xd8;
const SOS = 0xda;
const COM = 0xfe;
const isApp = (m: number) => m >= 0xe0 && m <= 0xef;
// Start-of-frame markers carry the size (C0–CF except DHT C4, JPG C8, DAC CC).
const isSof = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
const standalone = (m: number) => (m >= 0xd0 && m <= 0xd7) || m === 0x01;

export function stripJpegMetadata(input: Uint8Array): StrippedJpeg {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== SOI) throw new Error('not_jpeg');
  const out: Uint8Array[] = [input.subarray(0, 2)];
  let pos = 2;
  let width = 0;
  let height = 0;
  let sawScan = false;
  while (pos < input.length) {
    if (input[pos] !== 0xff) throw new Error('corrupt_jpeg');
    while (input[pos] === 0xff && pos < input.length) pos++; // fill bytes
    const marker = input[pos];
    if (marker === undefined) throw new Error('corrupt_jpeg');
    const start = pos - 1;
    pos++;
    if (standalone(marker)) {
      out.push(input.subarray(start, pos));
      continue;
    }
    if (marker === SOS) {
      // Entropy-coded data to the end of the file (including later scans and EOI) is image data: keep it all.
      out.push(input.subarray(start));
      sawScan = true;
      break;
    }
    if (pos + 2 > input.length) throw new Error('corrupt_jpeg');
    const len = (input[pos]! << 8) | input[pos + 1]!;
    if (len < 2 || pos + len > input.length) throw new Error('corrupt_jpeg');
    const end = pos + len;
    if (isSof(marker)) {
      if (len < 7) throw new Error('corrupt_jpeg');
      height = (input[pos + 3]! << 8) | input[pos + 4]!;
      width = (input[pos + 5]! << 8) | input[pos + 6]!;
    }
    const drop = marker === COM || (isApp(marker) && marker !== 0xe0);
    if (!drop) out.push(input.subarray(start, end));
    pos = end;
  }
  if (!sawScan || !width || !height) throw new Error('corrupt_jpeg');
  const total = out.reduce((n, b) => n + b.length, 0);
  const bytes = new Uint8Array(total);
  let o = 0;
  for (const b of out) {
    bytes.set(b, o);
    o += b.length;
  }
  return { bytes, width, height };
}

/** True if any metadata segment (APP1–APP15 or COM) remains before the image data. */
export function hasJpegMetadata(input: Uint8Array): boolean {
  let pos = 2;
  while (pos + 4 <= input.length && input[pos] === 0xff) {
    const marker = input[pos + 1]!;
    if (marker === SOS) return false;
    if (standalone(marker)) {
      pos += 2;
      continue;
    }
    if (marker === COM || (isApp(marker) && marker !== 0xe0)) return true;
    pos += 2 + ((input[pos + 2]! << 8) | input[pos + 3]!);
  }
  return false;
}
