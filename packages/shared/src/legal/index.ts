/** Legal document helpers: front matter parsing and {{token}} rendering from app_settings. */

export interface LegalDocument {
  slug: string;
  title: string;
  version: string;
  body: string;
}

/**
 * Template token -> app_settings key. Text lives in settings, never in code.
 * The operator's address is deliberately NOT a token: it is non-public and never rendered (owner decision 2026-10-15).
 */
export const LEGAL_TOKEN_SETTINGS = {
  operator_name: 'legal.operator_name',
  support_email: 'legal.support_email',
  child_safety_contact_email: 'legal.child_safety_contact_email',
  website: 'legal.website',
  hosting_region: 'legal.hosting_region',
  minors_notice: 'legal.minors_notice',
  community_disclaimer: 'community.disclaimer',
  refund_processing_days: 'payments.refund_processing_days',
  cancel_refund_after_live_percent: 'payments.cancel_refund_after_live_percent',
} as const;
export type LegalToken = keyof typeof LEGAL_TOKEN_SETTINGS;

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n?/;

export function parseLegalDocument(source: string): LegalDocument {
  const m = FRONT_MATTER.exec(source);
  if (!m) throw new Error('Legal document is missing front matter');
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const { slug, title, version } = meta;
  if (!slug || !title || !version) throw new Error('Front matter needs slug, title and version');
  return { slug, title, version, body: source.slice(m[0].length).trim() };
}

export interface RenderedLegal {
  text: string;
  missing: LegalToken[];
}

/** Replace {{token}}s. Unknown tokens are left visible; missing values render as a clear placeholder. */
export function renderLegalTemplate(body: string, values: Partial<Record<LegalToken, string | null | undefined>>): RenderedLegal {
  const missing = new Set<LegalToken>();
  const text = body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, token: string) => {
    if (!(token in LEGAL_TOKEN_SETTINGS)) return whole;
    const value = values[token as LegalToken];
    if (value == null || value.trim() === '') {
      missing.add(token as LegalToken);
      return `[${token.replace(/_/g, ' ')} — not yet set]`;
    }
    return value;
  });
  return { text, missing: [...missing] };
}

/** Build token values from app_settings rows ({ key, value }). */
export function legalValuesFromSettings(rows: { key: string; value: unknown }[]): Partial<Record<LegalToken, string>> {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out: Partial<Record<LegalToken, string>> = {};
  for (const [token, key] of Object.entries(LEGAL_TOKEN_SETTINGS) as [LegalToken, string][]) {
    const v = byKey.get(key);
    if (typeof v === 'string' && v.trim() !== '') out[token] = v;
  }
  return out;
}
