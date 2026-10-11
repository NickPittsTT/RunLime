// Minimal REST helpers (no npm imports: faster cold starts, no third-party fetch at boot).

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'access-control-allow-origin': allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] ?? ''),
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'GET, PUT, DELETE, POST, OPTIONS',
    vary: 'origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(req) },
  });
}

export interface UserSession {
  userId: string;
  /** PostgREST call as the user (RLS applies). */
  rest: (path: string, init?: RequestInit) => Promise<Response>;
}

/** Resolves the calling user from their access token. Returns null when there is no valid session. */
export async function userSession(req: Request): Promise<UserSession | null> {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const res = await fetch(`${url}/auth/v1/user`, { headers: { authorization, apikey: anonKey } });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  if (!user.id) return null;
  return {
    userId: user.id,
    rest: (path, init = {}) =>
      fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: { authorization, apikey: anonKey, 'content-type': 'application/json', ...(init.headers ?? {}) },
      }),
  };
}

export async function expectOk(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  return res;
}
