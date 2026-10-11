import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, PageTitle } from '@/components/ui';
import { requireProfile } from '@/lib/auth';
import { signOut } from './actions';
import { ExportButton } from './ExportButton';

export const metadata: Metadata = { title: 'Your account' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const { user, profile, roles, supabase } = await requireProfile('/account');
  const { data: area } = await supabase.from('regions').select('name').eq('id', profile.home_region_id).maybeSingle();
  const isAdmin = roles.includes('platform_admin') || roles.includes('super_admin');
  return (
    <>
      <PageTitle lead={user.email}>Hi, {profile.display_name}</PageTitle>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 mb-8">
        <dt className="font-semibold">Nickname</dt>
        <dd>{profile.nickname ?? '—'}</dd>
        <dt className="font-semibold">Home area</dt>
        <dd>{area?.name ?? '—'}</dd>
        <dt className="font-semibold">Account</dt>
        <dd>{profile.account_privacy === 'public' ? 'Public' : 'Private'}</dd>
      </dl>
      <p className="mb-6 text-ink-muted">Edit your profile, emergency contact and privacy settings in the RunLime app.</p>
      <div className="flex flex-wrap gap-3 mb-8">
        <Link href="/organiser" className="font-semibold">
          Organiser portal
        </Link>
        {isAdmin && (
          <Link href="/admin" className="font-semibold">
            Admin console
          </Link>
        )}
      </div>
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2">Your data</h2>
        <p className="mb-3">Download everything RunLime holds about you.</p>
        <ExportButton />
      </section>
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2">Delete account</h2>
        <Link href="/delete-account">Delete my account</Link>
      </section>
      <form action={signOut}>
        <Button variant="secondary" type="submit">
          Sign out
        </Button>
      </form>
    </>
  );
}
