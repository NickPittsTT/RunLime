import { describe, expect, it } from 'vitest';
import { REPORT_CATEGORIES, RUNNER_LEVELS, avatarUrl, reportSchema, runnerLevelLabel } from '../src/community';

describe('community rules', () => {
  it('runner levels match the database enum', () => {
    expect(RUNNER_LEVELS.map((l) => l.value)).toEqual(['casual', 'club_runner', 'competitive']);
    expect(runnerLevelLabel('club_runner')).toBe('Club runner');
    expect(runnerLevelLabel(null)).toBeNull();
  });
  it('report categories match the database enum, child safety first', () => {
    expect(REPORT_CATEGORIES.map((c) => c.value)).toEqual(['child_safety', 'sexual_content', 'harassment', 'hate_or_violence', 'impersonation', 'spam', 'other']);
  });
  it('a general safety concern needs a description; a photo report does not', () => {
    expect(reportSchema.safeParse({ category: 'child_safety', targetKind: 'general', details: 'short' }).success).toBe(false);
    expect(reportSchema.safeParse({ category: 'child_safety', targetKind: 'general', details: 'An adult is asking for photos of children' }).success).toBe(true);
    expect(reportSchema.safeParse({ category: 'sexual_content', targetKind: 'profile_photo', targetUserId: '0b4d3c2a-1111-4222-8333-444455556666' }).success).toBe(true);
    expect(reportSchema.safeParse({ targetKind: 'general', details: 'no category given here' }).success).toBe(false);
  });
  it('builds public photo URLs', () => {
    expect(avatarUrl('https://x.supabase.co', 'u/p.jpg')).toBe('https://x.supabase.co/storage/v1/object/public/avatars/u/p.jpg');
    expect(avatarUrl('https://x.supabase.co', null)).toBeNull();
  });
});
