import { devices, expect, test } from '@playwright/test';
import { admin, signInAdmin, signedInUser } from './helpers';

test('attendance page (O10): totals, children as a total only, trend with a table view, club turnout; on a phone', async ({ browser }) => {
  const db = admin();
  const { data: area } = await db.from('regions').select('id').eq('kind', 'area').limit(1).single();
  const { data: ev } = await db
    .from('events')
    .insert({ listing_source: 'runlime', slug: `e2e-attend-${Date.now()}`, name: `E2E Attendance 5K ${Date.now()}`, starts_at: new Date(Date.now() + 25 * 86_400_000).toISOString(), region_id: area!.id, venue_name: 'Savannah', start_lat: 10.67, start_lng: -61.51, registration_url: 'https://example.org/r', status: 'published', published_at: new Date().toISOString() })
    .select('id')
    .single();
  const ana = await signedInUser('Attend Ana Secretname');
  const ben = await signedInUser('Attend Ben');
  const cat = await signedInUser('Attend Cat');
  await ana.client.rpc('set_rsvp', { p_event: ev!.id, p_status: 'going', p_adults: 2, p_children: 3 });
  await ben.client.rpc('set_rsvp', { p_event: ev!.id, p_status: 'going', p_adults: 1, p_children: 0 });
  await cat.client.rpc('set_rsvp', { p_event: ev!.id, p_status: 'maybe', p_adults: 1, p_children: 0 });

  const { ctx, page } = await signInAdmin(browser, { ...devices['Pixel 7'] });
  await page.goto(`/admin/events/${ev!.id}`);
  const panel = page.getByTestId('attendance');
  await expect(panel.getByRole('heading', { name: 'Attendance' })).toBeVisible();
  const tile = (label: string) => panel.locator('dl > div').filter({ hasText: label }).locator('dd').first();
  await expect(tile('Adults going')).toHaveText('3');
  await expect(tile('Children coming')).toHaveText('3');
  await expect(tile('Maybe')).toHaveText('1');
  await expect(panel).not.toContainText('Secretname'); // no names
  await expect(panel.getByRole('img', { name: /Adults going over time: from \d+ to 3/ })).toBeVisible();
  await panel.getByText('Show as a table').click();
  await expect(panel.getByRole('table')).toContainText('3');
  await panel.screenshot({ path: test.info().outputPath('attendance-phone.png') });
  // Fits a phone: no horizontal scrolling.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await ctx.close();
});
