import { createClient } from '@supabase/supabase-js';

/** Dev tooling must never touch production. */
export function assertNonProduction(url: string): void {
  const env = process.env.RUNLIME_ENV ?? 'local';
  const prodUrl = process.env.RUNLIME_PRODUCTION_SUPABASE_URL;
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url);
  if (env === 'production' || (prodUrl && url.startsWith(prodUrl)) || (!isLocal && env !== 'staging')) {
    console.error(`Refusing to run: RUNLIME_ENV=${env}, SUPABASE_URL=${url}. Dev seed runs only on local or staging.`);
    process.exit(1);
  }
}

export function adminClient() {
  const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  return { url, client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) };
}
