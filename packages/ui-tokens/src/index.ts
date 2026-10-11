/**
 * Brand Direction A — "Fresh Lime" (approved 2026-10-11).
 * Lime is a FILL colour only: never use it for text or thin icons on light backgrounds (1.51:1 on white).
 * Contrast ratios (WCAG 2.x) are asserted in test/contrast.test.ts.
 */
export const colors = {
  lime: '#A3E635', // accent fill; put `ink` text on it
  leaf: '#3F7D0F', // actions & links on light backgrounds (5.06:1 on white)
  forest: '#14532D', // deep brand colour, app icon background
  ink: '#0F172A', // primary text
  inkMuted: '#475569', // secondary text (7.58:1 on white)
  background: '#FFFFFF',
  surface: '#F7FBEF',
  border: '#D9E3CC',
  danger: '#B91C1C', // 6.47:1 on white
  warning: '#92400E',
  success: '#166534',
  white: '#FFFFFF',
} as const;

export const darkColors = {
  lime: '#A3E635',
  leaf: '#A3E635',
  forest: '#14532D',
  ink: '#F1F5F9',
  inkMuted: '#CBD5E1',
  background: '#0B1210',
  surface: '#14201A',
  border: '#24352B',
  danger: '#F87171',
  warning: '#FBBF24',
  success: '#4ADE80',
  white: '#FFFFFF',
} as const;

export type ColorName = keyof typeof colors;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
/** Minimum body size 16 to stay readable on low-end screens; respect OS font scaling in apps. */
export const fontSize = { caption: 13, body: 16, bodyLarge: 18, title: 22, headline: 28, display: 34 } as const;
export const fontFamily = { ui: 'Inter', display: 'Archivo' } as const;
/** Minimum touch target (WCAG 2.5.5 / platform guidance). */
export const minTouchTarget = 48;

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
