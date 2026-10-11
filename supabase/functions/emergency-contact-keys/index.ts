// Key operations for emergency-contact encryption. SERVICE ROLE ONLY (never callable by app users).
//   POST { "mode": "verify" } -> counts per key version and how many rows each configured key can decrypt
//   POST { "mode": "rotate" } -> re-encrypts every row not on EMERGENCY_CONTACT_KEY_VERSION with the current key
// See docs/operations/EMERGENCY-CONTACT-KEY.md for the full backup and rotation procedure.
import { decryptString, encryptString, parseKeyVersion } from '../_shared/aesgcm.ts';
import { currentKeyVersion, keyFor } from '../_shared/emergencyContactKey.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BATCH = 500;

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  return res;
}

interface Row {
  user_id: string;
  emergency_contact_ciphertext: string;
  key_version: number;
}

async function* rows(filter = ''): AsyncGenerator<Row[]> {
  let after = '00000000-0000-0000-0000-000000000000';
  for (;;) {
    const res = await rest(
      `profile_private?select=user_id,emergency_contact_ciphertext,key_version&emergency_contact_ciphertext=not.is.null&user_id=gt.${after}${filter}&order=user_id&limit=${BATCH}`,
    );
    const batch = (await res.json()) as Row[];
    if (batch.length === 0) return;
    yield batch;
    after = batch[batch.length - 1]!.user_id;
  }
}

Deno.serve(async (req) => {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!serviceKey || !constantTimeEqual(token, serviceKey)) return reply({ error: 'forbidden' }, 403);
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  const { mode } = (await req.json().catch(() => ({}))) as { mode?: string };
  const current = currentKeyVersion();

  try {
    if (mode === 'verify') {
      const byVersion: Record<string, number> = {};
      let undecryptable = 0;
      for await (const batch of rows()) {
        for (const r of batch) {
          const v = parseKeyVersion(r.emergency_contact_ciphertext);
          byVersion[`v${v}`] = (byVersion[`v${v}`] ?? 0) + 1;
          try {
            await decryptString(await keyFor(v), r.emergency_contact_ciphertext, r.user_id);
          } catch {
            undecryptable++;
          }
        }
      }
      return reply({ currentVersion: current, byVersion, undecryptable });
    }

    if (mode === 'rotate') {
      const newKey = await keyFor(current);
      let rotated = 0;
      let failed = 0;
      for await (const batch of rows(`&key_version=neq.${current}`)) {
        for (const r of batch) {
          try {
            const plain = await decryptString(await keyFor(parseKeyVersion(r.emergency_contact_ciphertext)), r.emergency_contact_ciphertext, r.user_id);
            const next = await encryptString(newKey, current, plain, r.user_id);
            // Only replace the exact ciphertext we read (a concurrent user edit wins).
            await rest(
              `profile_private?user_id=eq.${r.user_id}&emergency_contact_ciphertext=eq.${encodeURIComponent(r.emergency_contact_ciphertext)}`,
              { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ emergency_contact_ciphertext: next, key_version: current }) },
            );
            rotated++;
          } catch {
            failed++;
          }
        }
      }
      return reply({ currentVersion: current, rotated, failed });
    }

    return reply({ error: 'mode must be "verify" or "rotate"' }, 400);
  } catch (err) {
    console.error('emergency-contact-keys failed', err instanceof Error ? err.message : 'unknown');
    return reply({ error: 'server_error' }, 500);
  }
});
