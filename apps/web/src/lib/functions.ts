import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Calls an Edge Function as the signed-in user (server side; the user's own access token). */
export async function callFunction(supabase: SupabaseClient, name: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
    cache: 'no-store',
  });
}
