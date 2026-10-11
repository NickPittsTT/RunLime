import 'server-only';
import { renderLegalTemplate, type LegalToken } from '@runlime/shared/legal';
import { getLegalValues } from './settings';
import { createClient } from './supabase/server';

export interface PublishedLegal {
  title: string;
  version: string;
  text: string;
  missing: LegalToken[];
  isDraft: boolean;
}

export async function getPublishedLegal(slug: string): Promise<PublishedLegal | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('legal_documents')
    .select('title, version, body_md, published_at')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const rendered = renderLegalTemplate(data.body_md, await getLegalValues());
  return { title: data.title, version: data.version, ...rendered, isDraft: /draft/i.test(data.version) };
}
