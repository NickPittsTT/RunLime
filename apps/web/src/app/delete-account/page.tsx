import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LegalBanner } from '@/components/LegalBanner';
import { Markdown } from '@/components/Markdown';
import { Notice } from '@/components/ui';
import { getSession } from '@/lib/auth';
import { getPublishedLegal } from '@/lib/legal';
import { DeleteForm } from './DeleteForm';

export const metadata: Metadata = { title: 'Delete your account' };
export const dynamic = 'force-dynamic';

export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  if (deleted) {
    return (
      <Notice tone="success">
        <strong>Your RunLime account has been deleted.</strong> Remember to cancel any Premium subscription in your App Store or Google Play
        settings.
      </Notice>
    );
  }
  const [doc, session] = await Promise.all([getPublishedLegal('delete-account'), getSession()]);
  if (!doc) notFound();
  return (
    <article>
      <LegalBanner doc={doc} />
      <Markdown>{doc.text}</Markdown>
      {session.user?.email ? (
        <DeleteForm email={session.user.email} />
      ) : (
        <p className="mt-6">
          <Link href="/sign-in?next=/delete-account" className="font-semibold">
            Sign in to delete your account →
          </Link>
        </p>
      )}
    </article>
  );
}
