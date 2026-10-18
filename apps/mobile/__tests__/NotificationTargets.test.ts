import { notificationTarget, notificationUrl } from '@/lib/notifications';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const n = (kind: string, data: Record<string, unknown>) => ({ id: '1', kind, title: 't', body: '', data, created_at: '', read_at: null });

describe('where a notification opens', () => {
  it('admin report alerts open the admin console on the website (https only)', () => {
    expect(notificationUrl(n('report_received', { report_id: 'r1', url: 'https://site.example/admin/reports' }))).toBe('https://site.example/admin/reports');
    expect(notificationUrl(n('report_received', { url: 'javascript:alert(1)' }))).toBeNull();
    expect(notificationUrl(n('race_postponed', { url: 'https://x.example' }))).toBeNull();
  });
  it('a new club leader goes to the club page', () => {
    expect(notificationTarget(n('club_leader_assigned', { club_id: 'c1' }))).toEqual({ pathname: '/club/[id]', params: { id: 'c1' } });
  });
});
