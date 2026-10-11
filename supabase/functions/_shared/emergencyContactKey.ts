import { importKey } from './aesgcm.ts';

/** Current key version + keyring from secrets: EMERGENCY_CONTACT_KEY_V1, _V2, ... and EMERGENCY_CONTACT_KEY_VERSION. */
export function currentKeyVersion(): number {
  return Number(Deno.env.get('EMERGENCY_CONTACT_KEY_VERSION') ?? '1');
}

export async function keyFor(version: number): Promise<CryptoKey> {
  const b64 = Deno.env.get(`EMERGENCY_CONTACT_KEY_V${version}`);
  if (!b64) throw new Error(`Missing secret EMERGENCY_CONTACT_KEY_V${version}`);
  return importKey(b64);
}
