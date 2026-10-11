import type { PublishedLegal } from '@/lib/legal';
import { Notice } from './ui';

export function LegalBanner({ doc }: { doc: PublishedLegal }) {
  if (!doc.isDraft && doc.missing.length === 0) return null;
  return (
    <Notice tone="warning">
      <strong>DRAFT</strong>
      {doc.missing.length > 0 ? ' — operator details missing. ' : ' — '}
      This document is awaiting legal review and is not yet final (version {doc.version}).
    </Notice>
  );
}
