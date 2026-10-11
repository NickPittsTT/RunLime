// Returns all personal data for the signed-in user as JSON (download in app or web).
import { decryptString, parseKeyVersion } from '../_shared/aesgcm.ts';
import { keyFor } from '../_shared/emergencyContactKey.ts';
import { corsHeaders, expectOk, json, userSession } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  const session = await userSession(req);
  if (!session) return json(req, { error: 'unauthorised' }, 401);
  const { rest, userId } = session;

  try {
    const data = (await (await expectOk(await rest('rpc/export_my_data', { method: 'POST', body: '{}' }))).json()) as Record<string, unknown>;
    const rows = (await (await expectOk(await rest('profile_private?select=emergency_contact_ciphertext'))).json()) as {
      emergency_contact_ciphertext: string | null;
    }[];
    let emergencyContact: unknown = null;
    const ct = rows[0]?.emergency_contact_ciphertext;
    if (ct) emergencyContact = JSON.parse(await decryptString(await keyFor(parseKeyVersion(ct)), ct, userId));
    return new Response(JSON.stringify({ ...data, emergency_contact: emergencyContact }, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="runlime-my-data.json"',
        'cache-control': 'no-store',
        ...corsHeaders(req),
      },
    });
  } catch (err) {
    console.error('export-user-data failed', err instanceof Error ? err.message : 'unknown');
    return json(req, { error: 'server_error' }, 500);
  }
});
