import { describe, expect, it } from 'vitest';
import { decryptString, encryptString, importKey, parseKeyVersion } from '../../../supabase/functions/_shared/aesgcm';

const keyB64 = Buffer.from(new Uint8Array(32).map((_, i) => i + 1)).toString('base64');
const otherKeyB64 = Buffer.from(new Uint8Array(32).fill(9)).toString('base64');

describe('emergency contact encryption (AES-256-GCM)', () => {
  it('round-trips and never contains plaintext', async () => {
    const key = await importKey(keyB64);
    const ct = await encryptString(key, 1, '{"name":"Mum","phone":"+1 868 555 0100"}', 'user-1');
    expect(ct).not.toContain('Mum');
    expect(parseKeyVersion(ct)).toBe(1);
    expect(await decryptString(key, ct, 'user-1')).toContain('Mum');
  });

  it('uses a fresh IV each time', async () => {
    const key = await importKey(keyB64);
    expect(await encryptString(key, 1, 'x', 'u')).not.toEqual(await encryptString(key, 1, 'x', 'u'));
  });

  it('fails with the wrong key or when moved to another user (AAD)', async () => {
    const key = await importKey(keyB64);
    const ct = await encryptString(key, 1, 'secret', 'user-1');
    await expect(decryptString(await importKey(otherKeyB64), ct, 'user-1')).rejects.toThrow();
    await expect(decryptString(key, ct, 'user-2')).rejects.toThrow();
  });

  it('rejects keys that are not 32 bytes', async () => {
    await expect(importKey(Buffer.from('short').toString('base64'))).rejects.toThrow();
  });
});
