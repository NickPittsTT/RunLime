// Emergency contact: encrypted in this function (AES-256-GCM); the database only ever sees ciphertext (F5).
// GET -> { contact | null }   PUT { name, phone, relationship? } -> { ok }   DELETE -> { ok }
import { decryptString, encryptString, parseKeyVersion } from '../_shared/aesgcm.ts';
import { currentKeyVersion, keyFor } from '../_shared/emergencyContactKey.ts';
import { corsHeaders, expectOk, json, userSession } from '../_shared/http.ts';

const PHONE = /^\+?[0-9 ()-]{7,20}$/;

function validate(body: unknown): { name: string; phone: string; relationship?: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { name, phone, relationship } = body as Record<string, unknown>;
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 80) return null;
  if (typeof phone !== 'string' || !PHONE.test(phone.trim())) return null;
  if (relationship !== undefined && (typeof relationship !== 'string' || relationship.trim().length > 40)) return null;
  return { name: name.trim(), phone: phone.trim(), ...(relationship ? { relationship: (relationship as string).trim() } : {}) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) });
  const session = await userSession(req);
  if (!session) return json(req, { error: 'unauthorised' }, 401);
  const { rest, userId } = session;

  try {
    if (req.method === 'GET') {
      const rows = (await (await expectOk(await rest('profile_private?select=emergency_contact_ciphertext'))).json()) as {
        emergency_contact_ciphertext: string | null;
      }[];
      const ct = rows[0]?.emergency_contact_ciphertext;
      if (!ct) return json(req, { contact: null });
      const plaintext = await decryptString(await keyFor(parseKeyVersion(ct)), ct, userId);
      return json(req, { contact: JSON.parse(plaintext) });
    }

    if (req.method === 'PUT') {
      const contact = validate(await req.json().catch(() => null));
      if (!contact) return json(req, { error: 'invalid_contact' }, 400);
      const version = currentKeyVersion();
      const ciphertext = await encryptString(await keyFor(version), version, JSON.stringify(contact), userId);
      await expectOk(
        await rest('profile_private?on_conflict=user_id', {
          method: 'POST',
          headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ user_id: userId, emergency_contact_ciphertext: ciphertext, key_version: version }),
        }),
      );
      return json(req, { ok: true });
    }

    if (req.method === 'DELETE') {
      await expectOk(await rest(`profile_private?user_id=eq.${userId}`, { method: 'DELETE' }));
      return json(req, { ok: true });
    }

    return json(req, { error: 'method_not_allowed' }, 405);
  } catch (err) {
    console.error('emergency-contact failed', err instanceof Error ? err.message : 'unknown');
    return json(req, { error: 'server_error' }, 500);
  }
});
