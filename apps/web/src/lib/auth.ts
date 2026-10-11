import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export type AppRole = 'super_admin' | 'platform_admin' | 'organiser' | 'participant';

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, roles: [] as AppRole[] };
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, nickname, home_region_id, account_privacy').maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
  ]);
  return { supabase, user, profile, roles: (roleRows ?? []).map((r) => r.role as AppRole) };
}

/** Signed in AND finished the age gate/profile. */
export async function requireProfile(next: string) {
  const session = await getSession();
  if (!session.user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (!session.profile) redirect(`/complete-profile?next=${encodeURIComponent(next)}`);
  return session as typeof session & { user: NonNullable<typeof session.user>; profile: NonNullable<typeof session.profile> };
}

/** Admin console: role + MFA (aal2). The database enforces the same rule via is_admin(). */
export async function requireAdmin(next = '/admin') {
  const session = await requireProfile(next);
  const isAdmin = session.roles.includes('platform_admin') || session.roles.includes('super_admin');
  if (!isAdmin) redirect('/account');
  const { data } = await session.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel !== 'aal2') redirect(`/admin/mfa?next=${encodeURIComponent(next)}`);
  return { ...session, isSuperAdmin: session.roles.includes('super_admin') };
}
