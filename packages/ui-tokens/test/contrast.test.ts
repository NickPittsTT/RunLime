import { describe, expect, it } from 'vitest';
import { colors, contrastRatio, darkColors } from '../src';

describe('Direction A contrast (WCAG AA 4.5:1 for text)', () => {
  it.each([
    ['ink on background', colors.ink, colors.background],
    ['ink on surface', colors.ink, colors.surface],
    ['inkMuted on background', colors.inkMuted, colors.background],
    ['leaf links on background', colors.leaf, colors.background],
    ['white on leaf buttons', colors.white, colors.leaf],
    ['ink on lime fill', colors.ink, colors.lime],
    ['lime on forest', colors.lime, colors.forest],
    ['danger on background', colors.danger, colors.background],
    ['dark: ink on background', darkColors.ink, darkColors.background],
    ['dark: inkMuted on surface', darkColors.inkMuted, darkColors.surface],
    ['dark: lime links on background', darkColors.leaf, darkColors.background],
    ['dark: danger on background', darkColors.danger, darkColors.background],
  ])('%s ≥ 4.5', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('documents that lime must never be text on white', () => {
    expect(contrastRatio(colors.lime, colors.background)).toBeLessThan(3);
  });
});
