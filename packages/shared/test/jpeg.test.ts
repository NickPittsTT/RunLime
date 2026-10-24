/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { hasJpegMetadata, stripJpegMetadata } from '../../../supabase/functions/_shared/jpeg';

const seg = (marker: number, payload: number[]) => [0xff, marker, ((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff, ...payload];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
// A minimal JPEG layout: SOI, JFIF, EXIF with GPS data, XMP, comment, DQT, SOF0 (640x480), DHT, SOS + data, EOI.
const exifGps = seg(0xe1, [...ascii('Exif\0\0'), ...ascii('GPSLatitude 10.6644N GPSLongitude 61.5199W')]);
const xmp = seg(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/\0'), ...ascii('<x:xmpmeta>location</x:xmpmeta>')]);
const comment = seg(0xfe, ascii('taken at home'));
const jfif = seg(0xe0, [...ascii('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const dqt = seg(0xdb, [0, ...new Array(64).fill(1)]);
const sof = seg(0xc0, [8, 0x01, 0xe0, 0x02, 0x80, 1, 1, 0x11, 0]);
const dht = seg(0xc4, [0, ...new Array(16).fill(0)]);
const sos = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9];
const jpeg = new Uint8Array([0xff, 0xd8, ...jfif, ...exifGps, ...xmp, ...comment, ...dqt, ...sof, ...dht, ...sos]);
const text = (b: Uint8Array) => Buffer.from(b).toString('latin1');

describe('profile photo metadata stripping', () => {
  it('removes EXIF (incl. GPS location), XMP and comments, keeps the image data', () => {
    expect(hasJpegMetadata(jpeg)).toBe(true);
    const { bytes, width, height } = stripJpegMetadata(jpeg);
    expect([width, height]).toEqual([640, 480]);
    expect(hasJpegMetadata(bytes)).toBe(false);
    for (const leak of ['GPS', 'Exif', 'xmpmeta', 'location', 'taken at home']) expect(text(bytes)).not.toContain(leak);
    expect(text(bytes)).toContain('JFIF');
    // Everything from the scan to the end is unchanged.
    expect(Array.from(bytes.slice(-sos.length))).toEqual(sos);
    expect(bytes.length).toBe(jpeg.length - exifGps.length - xmp.length - comment.length);
  });
  it('is idempotent', () => {
    const once = stripJpegMetadata(jpeg).bytes;
    expect(Array.from(stripJpegMetadata(once).bytes)).toEqual(Array.from(once));
  });
  it('rejects files that are not JPEG photos', () => {
    expect(() => stripJpegMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toThrow('not_jpeg');
    expect(() => stripJpegMetadata(new Uint8Array([0xff, 0xd8, ...jfif, 0xff, 0xd9]))).toThrow('corrupt_jpeg');
    expect(() => stripJpegMetadata(jpeg.slice(0, 40))).toThrow('corrupt_jpeg');
  });
});
