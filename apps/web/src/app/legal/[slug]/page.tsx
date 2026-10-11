import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalBanner } from '@/components/LegalBanner';
import { Markdown } from '@/components/Markdown';
import { getPublishedLegal } from '@/lib/legal';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['privacy', 'terms', 'moderation', 'child-safety', 'health', 'community-times']);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = ALLOWED.has(slug) ? await getPublishedLegal(slug) : null;
  return { title: doc?.title ?? 'Legal' };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!ALLOWED.has(slug)) notFound();
  const doc = await getPublishedLegal(slug);
  if (!doc) notFound();
  return (
    <article>
      <LegalBanner doc={doc} />
      <Markdown>{doc.text}</Markdown>
      <p className="text-sm text-ink-muted mt-8">Version {doc.version}</p>
    </article>
  );
}
