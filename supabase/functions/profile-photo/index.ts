// Profile photos (Phase 3). The only writer of the public "avatars" bucket and profiles.avatar_path.
//   POST  image/jpeg body        → strip all metadata (EXIF/GPS, XMP, comments), store, set as the caller's photo
//   DELETE                       → remove the caller's photo (also used before account deletion)
//   POST  {"action":"admin_remove","userId":…,"reportId"?:…,"note"?:…} → admin (MFA) removes someone's photo
// Old files are deleted when replaced or removed, so a removed photo stops being served.
import { stripJpegMetadata } from '../_shared/jpeg.ts';
import { corsHeaders, expectOk, json, userSession } from '../_shared/http.ts';

const MAX_BYTES = 1024 * 1024;
const MIN_SIDE = 64;
const MAX_SIDE = 2048;
const UUID = /^[0-9a-f-]{36}$/;

const url = () => Deno.env.get('SUPABASE_URL')!;
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const service = (path: string, init: RequestInit = {}) =>
  fetch(`${url()}${path}`, { ...init, headers: { authorization: `Bearer ${serviceKey()}`, apikey: serviceKey(), ...(init.headers ?? {}) } });

async function currentPath(userId: string): Promise<string | null> {
  const rows = (await (await expectOk(await service(`/rest/v1/profiles?id=eq.${userId}&select=avatar_path`))).json()) as { avatar_path: string | null }[];
  return rows[0]?.avatar_path ?? null;
}

async function setPath(userId: string, path: string | null): Promise<void> {
  await expectOk(
    await service(`/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({ avatar_path: path, avatar_updated_at: new Date().toISOString() }),
    }),
  );
}

async function deleteFile(path: string | null): Promise<void> {
  if (!path) return;
  const res = await service('/storage/v1/object/avatars', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: [path] }),
  });
  if (!res.ok) console.error('profile-photo: file delete failed', res.status);
}

function randomName(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) });
  const session = await userSession(req);
  if (!session) return json(req, { error: 'unauthorised' }, 401);
  const { userId, rest } = session;
  try {
    if (req.method === 'DELETE') {
      const old = await currentPath(userId);
      await setPath(userId, null);
      await deleteFile(old);
      return json(req, { ok: true });
    }
    if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

    const type = req.headers.get('content-type') ?? '';
    if (type.startsWith('application/json')) {
      const body = (await req.json().catch(() => ({}))) as { action?: string; userId?: string; reportId?: string | null; note?: string };
      if (body.action !== 'admin_remove' || !body.userId || !UUID.test(body.userId) || (body.reportId && !UUID.test(body.reportId))) {
        return json(req, { error: 'bad_request' }, 400);
      }
      // Runs as the caller: admin_remove_avatar checks admin role + MFA and records the removal.
      const res = await rest('rpc/admin_remove_avatar', {
        method: 'POST',
        body: JSON.stringify({ p_user: body.userId, p_report: body.reportId ?? null, p_note: body.note ?? null }),
      });
      if (res.status === 401 || res.status === 403) return json(req, { error: 'forbidden' }, 403);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
        return json(req, { error: err.code === '42501' ? 'forbidden' : 'failed', message: err.message }, err.code === '42501' ? 403 : 400);
      }
      await deleteFile((await res.json()) as string | null);
      return json(req, { ok: true });
    }

    if (!type.startsWith('image/jpeg')) return json(req, { error: 'jpeg_only' }, 415);
    const raw = new Uint8Array(await req.arrayBuffer());
    if (raw.length === 0 || raw.length > MAX_BYTES) return json(req, { error: 'too_large' }, 413);
    let photo;
    try {
      photo = stripJpegMetadata(raw);
    } catch {
      return json(req, { error: 'not_a_photo' }, 422);
    }
    if (Math.min(photo.width, photo.height) < MIN_SIDE || Math.max(photo.width, photo.height) > MAX_SIDE) {
      return json(req, { error: 'bad_size' }, 422);
    }
    const path = `${userId}/${randomName()}.jpg`;
    await expectOk(
      await service(`/storage/v1/object/avatars/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', 'x-upsert': 'false' },
        body: photo.bytes,
      }),
    );
    const old = await currentPath(userId);
    await setPath(userId, path);
    await deleteFile(old);
    return json(req, { ok: true, path });
  } catch (err) {
    console.error('profile-photo failed', err instanceof Error ? err.message : 'unknown');
    return json(req, { error: 'server_error' }, 500);
  }
});
