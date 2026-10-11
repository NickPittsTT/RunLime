import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageTitle } from '@/components/ui';
import { requireProfile } from '@/lib/auth';
import { MfaFlow } from './MfaFlow';

export const metadata: Metadata = { title: 'Two-factor authentication' };
export const dynamic = 'force-dynamic';

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next && next.startsWith('/admin') ? next : '/admin';
  const { roles } = await requireProfile('/admin/mfa');
  if (!roles.includes('platform_admin') && !roles.includes('super_admin')) redirect('/account');
  return (
    <>
      <PageTitle>Two-factor authentication</PageTitle>
      <MfaFlow next={target} />
    </>
  );
}
