import { devices, expect, test } from '@playwright/test';
import { admin, signInAdmin, signedInUser } from './helpers';

test('notifications: postponing on the website and an organiser update reach the runner\'s inbox; 2 updates per week', async ({ browser }) => {
  const db = admin();
  const { data: area } = await db.from('regions').select('id').eq('kind', 'area').limit(1).single();
  const name = `E2E Notify 5K ${Date.now()}`;
  const { data: ev } = await db
    .from('events')
    .insert({ listing_source: 'runlime', slug: `e2e-notify-${Date.now()}`, name, starts_at: new Date(Date.now() + 40 * 86_400_000).toISOString(), region_id: area!.id, venue_name: 'Savannah', start_lat: 10.67, start_lng: -61.51, registration_url: 'https://example.org/r', status: 'published', published_at: new Date().toISOString() })
    .select('id')
    .single();
  const runner = await signedInUser('Inbox Runner');
  await runner.client.rpc('set_rsvp', { p_event: ev!.id, p_status: 'going', p_adults: 1, p_children: 0 });

  const { ctx, page } = await signInAdmin(browser, { ...devices['Pixel 7'] });
  await page.goto(`/admin/events/${ev!.id}`);
  // Organiser update (race updates only).
  await page.getByLabel('Message', { exact: true }).fill('Race-pack collection moved to Friday 4 to 7 pm.');
  await page.getByRole('button', { name: 'Send update' }).click();
  await expect(page.getByText('Sent to 1 person.')).toBeVisible();
  await page.getByLabel('Message', { exact: true }).fill('Parking opens at 4:30 am.');
  await page.getByRole('button', { name: 'Send update' }).click();
  await expect(page.getByText('Sent to 1 person.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('0 of 2 left in the last 7 days.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send update' })).toBeDisabled();

  // Postpone to a new date on the website.
  const nextYear = new Date().getUTCFullYear() + 1;
  await page.getByLabel('Change').selectOption('postponed');
  await page.getByLabel('New date and time (leave blank if not known yet)').fill(`${nextYear}-03-07T06:30`);
  await page.getByLabel('Reason runners will see').fill('Heavy rain forecast');
  await page.getByRole('button', { name: 'Update status' }).click();
  await expect(page.getByText('The event is now postponed.')).toBeVisible();
  await ctx.close();

  // The runner's inbox (what the app reads).
  const { data: inbox } = await runner.client.from('notifications').select('kind, title, body, data').order('created_at');
  expect(inbox!.map((n) => n.kind)).toEqual(['organiser_message', 'organiser_message', 'race_postponed']);
  expect(inbox![2]!.title).toMatch(new RegExp(`^${name} is postponed to \\w{3} 0?7 Mar ${nextYear}, 6:30 am$`));
  expect(inbox![2]!.body).toBe('Heavy rain forecast');
  expect(inbox![0]!.body).toBe('Race-pack collection moved to Friday 4 to 7 pm.');
  const { data: unread } = await runner.client.from('notifications').select('id').is('read_at', null);
  expect(unread).toHaveLength(3);
  await runner.client.rpc('mark_notifications_read', { p_ids: null });
  expect((await runner.client.from('notifications').select('id').is('read_at', null)).data).toHaveLength(0);
});
