/// <reference types="node" />
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
      ['child-safety', 'community-times', 'delete-account', 'health', 'moderation', 'privacy', 'refunds', 'support', 'terms'].sort(),
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

  it('terms make a false date of birth a breach and grounds for closure', () => {
    const terms = docs.find((d) => d.doc.slug === 'terms')!.doc.body;
    expect(terms).toMatch(/true date of birth/);
    expect(terms).toMatch(/false date of birth[^.]*breach of these Terms and grounds for closing your account/);
  });

  it('moderation: 48-hour review target, child-safety reports first', () => {
    const mod = docs.find((d) => d.doc.slug === 'moderation')!.doc.body;
    expect(mod).toMatch(/within 48 hours/);
    expect(mod).toMatch(/Child-safety reports are always handled first/);
    expect(mod).not.toMatch(/24 hours/);
  });

  it('privacy policy states where data is stored and terms name the operator via settings', () => {
    const privacy = docs.find((d) => d.doc.slug === 'privacy')!.doc.body;
    expect(privacy).toMatch(/Your data is stored in \{\{hosting_region\}\}/);
    expect(privacy).toMatch(/United States/);
    const terms = docs.find((d) => d.doc.slug === 'terms')!.doc.body;
    expect(terms).toContain('RunLime, operated by {{operator_name}}');
  });

  it('no document publishes the operator address (owner decision 2026-10-15)', () => {
    expect(Object.keys(LEGAL_TOKEN_SETTINGS)).not.toContain('operator_address');
    expect(Object.values(LEGAL_TOKEN_SETTINGS)).not.toContain('legal.operator_address');
    for (const { doc } of docs) expect(doc.body).not.toMatch(/operator_address/);
    for (const slug of ['privacy', 'terms']) {
      expect(docs.find((d) => d.doc.slug === slug)!.doc.body).toMatch(/\{\{operator_name\}\} · \{\{support_email\}\}/);
    }
  });

  it('refund policy: the three refund cases, bank transfer, timing from a setting, Premium follows the stores', () => {
    const r = docs.find((d) => d.doc.slug === 'refunds')!.doc.body;
    expect(r).toMatch(/We reject your listing/);
    expect(r).toMatch(/You cancel your race before your listing is published\*\* \| Full refund/);
    expect(r).toContain('{{cancel_refund_after_live_percent}}% of the listing fee');
    expect(r).toMatch(/You paid twice/);
    expect(r).toMatch(/By \*\*bank transfer\*\*/);
    expect(r).toContain('{{refund_processing_days}} business days');
    expect(r).toMatch(/refunds follow Apple's and Google's rules/);
    expect(r).not.toMatch(/\b\d+ business days/);
  });

  it('privacy policy: cookies section (essential sign-in only, no analytics cookies, no banner) + attorney flag', () => {
    const privacy = docs.find((d) => d.doc.slug === 'privacy')!.doc.body;
    expect(privacy).toMatch(/## \d+\. Cookies/);
    expect(privacy).toMatch(/only cookie the website sets is the sign-in cookie/);
    expect(privacy).toMatch(/no analytics or advertising cookies/i);
    expect(privacy).toMatch(/cookieless/);
    expect(privacy).toMatch(/do not show a cookie banner/);
    expect(privacy).toMatch(/attorney[^_]*cookie/i);
  });

  it('privacy policy names the providers actually used', () => {
    const privacy = docs.find((d) => d.doc.slug === 'privacy')!.doc.body;
    expect(privacy).toMatch(/Gmail\) for sign-in emails/);
    expect(privacy).toMatch(/OpenFreeMap/);
    expect(privacy).not.toMatch(/Resend/);
  });

  it('terms explain RunLime listings: facts only; organiser images only with recorded permission; can be withdrawn', () => {
    const terms = docs.find((d) => d.doc.slug === 'terms')!.doc.body;
    expect(terms).toMatch(/Races listed by RunLime/);
    expect(terms).toMatch(/flyer, logo or sponsor names on such a listing only after the organiser has given us permission, and we keep a record/);
    expect(terms).toMatch(/withdraw their permission/);
  });

  it('terms point organisers to the refund policy', () => {
    const terms = docs.find((d) => d.doc.slug === 'terms')!.doc.body;
    expect(terms).toMatch(/\/legal\/refunds/);
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
