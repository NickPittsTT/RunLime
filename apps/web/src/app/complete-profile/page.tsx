import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageTitle } from '@/components/ui';
import { getSession } from '@/lib/auth';
import { CompleteProfileForm } from './CompleteProfileForm';

export const metadata: Metadata = { title: 'Finish setting up' };
export const dynamic = 'force-dynamic';

export default async function CompleteProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
  const { supabase, user, profile } = await getSession();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(target)}`);
  if (profile) redirect(target);
  const [{ data: areas }, { data: legal }] = await Promise.all([
    supabase.from('regions').select('id, name').eq('kind', 'area').order('sort'),
    supabase.from('legal_documents').select('slug, version').in('slug', ['terms', 'privacy']).not('published_at', 'is', null).order('published_at', { ascending: false }),
  ]);
  const versionOf = (slug: string) => legal?.find((d) => d.slug === slug)?.version ?? 'unpublished';
  return (
    <div className="max-w-md">
      <PageTitle lead="A few details and you're in.">Finish setting up</PageTitle>
      <CompleteProfileForm areas={areas ?? []} termsVersion={versionOf('terms')} privacyVersion={versionOf('privacy')} next={target} />
    </div>
  );
}
