import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalBanner } from '@/components/LegalBanner';
import { Markdown } from '@/components/Markdown';
import { getPublishedLegal } from '@/lib/legal';

export const metadata: Metadata = { title: 'Support' };
export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const doc = await getPublishedLegal('support');
  if (!doc) notFound();
  return (
    <article>
      <LegalBanner doc={doc} />
      <Markdown>{doc.text}</Markdown>
    </article>
  );
}
