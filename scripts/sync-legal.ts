/**
 * Loads docs/legal/*.md into public.legal_documents (one row per slug+version).
 * Run on deploy for every environment:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tsx scripts/sync-legal.ts [--publish]
 * Without --publish rows are inserted unpublished (draft); with it, new versions are published now.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLegalDocument } from '../packages/shared/src/legal';
import { adminClient } from './lib/env';

async function main() {
  const publish = process.argv.includes('--publish');
  const { client } = adminClient();
  const dir = join(__dirname, '../docs/legal');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && !['README.md', 'STORE-REQUIREMENTS.md'].includes(f));
  for (const file of files) {
    const doc = parseLegalDocument(readFileSync(join(dir, file), 'utf8'));
    const { error } = await client.from('legal_documents').upsert(
      { slug: doc.slug, version: doc.version, title: doc.title, body_md: doc.body, ...(publish ? { published_at: new Date().toISOString() } : {}) },
      { onConflict: 'slug,version' },
    );
    if (error) throw error;
    console.log(`${publish ? 'published' : 'synced'} ${doc.slug}@${doc.version}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
