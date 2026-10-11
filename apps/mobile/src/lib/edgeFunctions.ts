import { config } from './config';
import { supabase } from './supabase';

/** Calls an Edge Function as the signed-in user. */
export async function callFunction(name: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return fetch(`${config.supabaseUrl}/functions/v1/${name}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}
