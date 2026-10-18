import { devices, expect, test } from '@playwright/test';
import { admin, signInAdmin, signedInUser } from './helpers';

test('clubs: runner asks for a new club → admin approves on a phone (requester leads) → leader approves a member → turnout counts', async ({ browser, page }) => {
  const db = admin();
  const clubName = `E2E Pacers ${Date.now() % 1_000_000}`;
  const lead = await signedInUser('Club Lead');
  expect((await lead.client.rpc('request_new_club', { p_name: clubName, p_description: 'Weekend runs', p_region: null })).error).toBeNull();

  const { ctx, page: adminPage } = await signInAdmin(browser, { ...devices['Pixel 7'] });
  await adminPage.goto('/admin/clubs');
  const req = adminPage.getByTestId('club-request').filter({ hasText: clubName });
  await expect(req).toContainText('asked by Club Lead');
  await expect(req.getByRole('checkbox', { name: 'Make the requester its first leader' })).toBeChecked();
  await req.getByRole('button', { name: 'Approve' }).click();
  await expect(adminPage.getByText('Club created.')).toBeVisible();
  await ctx.close();

  const { data: club } = await db.from('clubs').select('id').eq('name', clubName).single();
  const { data: leadRow } = await db.from('club_members').select('role, status').eq('club_id', club!.id).eq('user_id', lead.id).single();
  expect(leadRow).toEqual({ role: 'leader', status: 'approved' });

  // Members ask to join; only the leader can approve.
  const members = await Promise.all([1, 2].map((i) => signedInUser(`Club Member ${i}`)));
  for (const m of members) expect((await m.client.rpc('request_join_club', { p_club: club!.id })).data).toBe('pending');
  expect((await members[1]!.client.rpc('respond_club_request', { p_club: club!.id, p_user: members[0]!.id, p_accept: true })).error?.code).toBe('42501');
  for (const m of members) expect((await lead.client.rpc('respond_club_request', { p_club: club!.id, p_user: m.id, p_accept: true })).error).toBeNull();

  // Turnout: 3 opted-in approved members going; shown only when at or above the minimum (setting, set to 3 here).
  await db.from('app_settings').update({ value: '3' }).eq('key', 'clubs.turnout_min');
  const { data: area } = await db.from('regions').select('id').eq('kind', 'area').limit(1).single();
  const slug = `e2e-turnout-${Date.now()}`;
  const { data: ev } = await db
    .from('events')
    .insert({ listing_source: 'runlime', slug, name: 'E2E Turnout 5K', starts_at: new Date(Date.now() + 20 * 86_400_000).toISOString(), region_id: area!.id, venue_name: 'Savannah', start_lat: 10.67, start_lng: -61.51, registration_url: 'https://example.org/r', status: 'published', published_at: new Date().toISOString() })
    .select('id')
    .single();
  for (const u of [lead, ...members]) {
    await db.from('profiles').update({ show_attendance_to_clubs: true }).eq('id', u.id);
    expect((await u.client.rpc('set_rsvp', { p_event: ev!.id, p_status: 'going', p_adults: 1, p_children: 0 })).error).toBeNull();
  }
  await page.goto(`/e/${slug}`);
  await expect(page.getByRole('list', { name: 'Club turnout' })).toContainText(`${clubName}: 3 going`);
  await db.from('profiles').update({ show_attendance_to_clubs: false }).eq('id', members[1]!.id);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Club turnout' })).toHaveCount(0); // 2 < minimum
  await db.from('app_settings').update({ value: '5' }).eq('key', 'clubs.turnout_min');
});
