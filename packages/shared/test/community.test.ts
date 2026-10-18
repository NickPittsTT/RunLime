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

describe('RSVPs', () => {
  it('options match the database enum', async () => {
    const { RSVP_OPTIONS } = await import('../src/community');
    expect(RSVP_OPTIONS.map((o) => o.value)).toEqual(['going', 'maybe', 'not_going']);
  });
  it('"N going" label', async () => {
    const { goingLabel } = await import('../src/community');
    expect(goingLabel(0)).toBeNull();
    expect(goingLabel(12)).toBe('12 going');
    expect(goingLabel(12, 3)).toBe('12 going · 3 maybe');
  });
  it('group limits apply to Going/Maybe only', async () => {
    const { rsvpSchema } = await import('../src/community');
    const s = rsvpSchema(10, 10);
    expect(s.safeParse({ status: 'going', adults: 2, children: 3 }).success).toBe(true);
    expect(s.safeParse({ status: 'going', adults: 0, children: 1 }).success).toBe(false);
    expect(s.safeParse({ status: 'maybe', adults: 1, children: 11 }).success).toBe(false);
    expect(s.safeParse({ status: 'not_going', adults: 0, children: 99 }).success).toBe(true);
  });
});
