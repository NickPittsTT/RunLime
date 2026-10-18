import { describe, expect, it } from 'vitest';
import { dailySummaryEmail, urgentEmail } from '../../../supabase/functions/_shared/alerts';

const q = 'https://site.example/admin/reports';

describe('admin alert emails', () => {
  it('child-safety email: urgent subject, link, no report text or names', () => {
    const e = urgentEmail({ id: 'r1', category: 'child_safety', target_kind: 'profile_photo', created_at: '2026-10-18T14:05:00Z' }, q);
    expect(e.subject).toBe('Urgent RunLime report: a child may be at risk');
    expect(e.text).toContain('received Sun, 18 Oct, 10:05 am');
    expect(e.text).toContain('about a profile photo');
    expect(e.text).toContain(q);
    expect(e.text).toContain('999');
  });
  it('daily summary counts by category and names the oldest; nothing to send → null', () => {
    expect(dailySummaryEmail([], q)).toBeNull();
    const e = dailySummaryEmail(
      [
        { id: '1', category: 'spam', target_kind: 'profile', created_at: '2026-10-18T12:00:00Z' },
        { id: '2', category: 'spam', target_kind: 'club', created_at: '2026-10-18T09:00:00Z' },
        { id: '3', category: 'harassment', target_kind: 'profile', created_at: '2026-10-18T15:00:00Z' },
      ],
      q,
    )!;
    expect(e.subject).toBe('RunLime: 3 new reports to review');
    expect(e.text).toMatch(/• Spam or scam: 2\n• Bullying or harassment: 1/);
    expect(e.text).toContain('Oldest: received Sun, 18 Oct, 5:00 am');
    expect(e.text).toContain('48 hours');
  });
});
