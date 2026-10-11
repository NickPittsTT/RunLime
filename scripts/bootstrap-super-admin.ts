/**
 * One-time: make an EXISTING, fully signed-up account the super admin.
 * The person must already have completed sign-up (age gate + profile) in the app or web portal.
 * They must enrol two-factor authentication at /admin/mfa before admin rights apply.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm bootstrap:super-admin owner@example.com
 */
import { adminClient } from './lib/env';

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error('Usage: pnpm bootstrap:super-admin <email>');
  const { client } = adminClient();
  const { count } = await client.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'super_admin');
  if ((count ?? 0) > 0 && !process.argv.includes('--allow-additional')) {
    throw new Error('A super admin already exists. Pass --allow-additional only if the owner has asked for a second one.');
  }
  let userId: string | undefined;
  for (let page = 1; page < 100 && !userId; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) throw new Error(`No account for ${email}. Sign up first.`);
  const { data: profile } = await client.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!profile) throw new Error('That account has not finished sign-up (no profile).');
  const { error } = await client.from('user_roles').upsert({ user_id: userId, role: 'super_admin' });
  if (error) throw error;
  console.log(`${email} is now super admin. Next: sign in at /admin and set up two-factor authentication.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
