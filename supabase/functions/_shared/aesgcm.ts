// AES-256-GCM envelope helpers (WebCrypto). Runs in Deno (Edge Functions) and Node 22 (tests).
// Ciphertext format: "v<keyVersion>:<base64 iv>:<base64 ciphertext+tag>".
// Keys are 32 random bytes, base64-encoded, supplied via Edge Function secrets — never stored in the database.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromBase64(base64Key);
  if (raw.length !== 32) throw new Error('Encryption key must be 32 bytes (base64-encoded)');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Additional authenticated data binds the ciphertext to its owner so it cannot be moved to another row. */
export async function encryptString(key: CryptoKey, keyVersion: number, plaintext: string, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(aad) },
    key,
    encoder.encode(plaintext),
  );
  return `v${keyVersion}:${toBase64(iv)}:${toBase64(new Uint8Array(ct))}`;
}

export function parseKeyVersion(ciphertext: string): number {
  const m = /^v(\d+):/.exec(ciphertext);
  if (!m) throw new Error('Malformed ciphertext');
  return Number(m[1]);
}

export async function decryptString(key: CryptoKey, ciphertext: string, aad: string): Promise<string> {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Malformed ciphertext');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(parts[1]!), additionalData: encoder.encode(aad) },
    key,
    fromBase64(parts[2]!),
  );
  return decoder.decode(pt);
}
