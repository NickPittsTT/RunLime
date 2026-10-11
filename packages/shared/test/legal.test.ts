import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGAL_TOKEN_SETTINGS, legalValuesFromSettings, parseLegalDocument, renderLegalTemplate } from '../src/legal';

const LEGAL_DIR = join(__dirname, '../../../docs/legal');
const docs = readdirSync(LEGAL_DIR)
  .filter((f) => f.endsWith('.md') && f !== 'README.md' && f !== 'STORE-REQUIREMENTS.md')
  .map((f) => ({ file: f, doc: parseLegalDocument(readFileSync(join(LEGAL_DIR, f), 'utf8')) }));

describe('legal documents', () => {
  it('all required documents exist', () => {
    expect(docs.map((d) => d.doc.slug).sort()).toEqual(
      ['child-safety', 'community-times', 'delete-account', 'health', 'moderation', 'privacy', 'support', 'terms'].sort(),
    );
  });

  it.each(docs)('$file only uses known tokens', ({ doc }) => {
    const tokens = [...doc.body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]);
    for (const t of tokens) expect(Object.keys(LEGAL_TOKEN_SETTINGS)).toContain(t);
  });

  it('terms state the 18+ rule and that minors must be accompanied', () => {
    const terms = docs.find((d) => d.doc.slug === 'terms')!.doc.body;
    expect(terms).toMatch(/18 or older/);
    expect(terms).toContain('{{minors_notice}}');
    expect(terms).toMatch(/renews automatically/);
  });

  it('privacy policy never mentions teen/minor accounts', () => {
    const privacy = docs.find((d) => d.doc.slug === 'privacy')!.doc.body;
    expect(privacy).not.toMatch(/13|teen/i);
  });
});

describe('renderLegalTemplate', () => {
  it('fills tokens and reports missing ones', () => {
    const r = renderLegalTemplate('By {{operator_name}} — {{support_email}} — {{unknown}}', { operator_name: 'RunLime Ltd' });
    expect(r.text).toBe('By RunLime Ltd — [support email — not yet set] — {{unknown}}');
    expect(r.missing).toEqual(['support_email']);
  });

  it('maps settings rows to tokens, ignoring null values', () => {
    expect(legalValuesFromSettings([
      { key: 'legal.operator_name', value: 'X' },
      { key: 'legal.support_email', value: null },
      { key: 'community.disclaimer', value: 'Unverified.' },
    ])).toEqual({ operator_name: 'X', community_disclaimer: 'Unverified.' });
  });
});
