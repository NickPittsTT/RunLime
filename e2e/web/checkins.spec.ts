import { expect, test } from '@playwright/test';
import { admin, signInAdmin, signedInUser } from './helpers';

test('GPS check-in (Phase 4): a runner too far away asks for help; an admin approves with a reason; a radius fix re-tests failed attempts', async ({ browser }) => {
  const db = admin();
  const { data: area } = await db.from('regions').select('id').eq('kind', 'area').limit(1).single();
  const name = `E2E Check-in 5K ${Date.now()}`;
  const { data: ev } = await db
    .from('events')
    .insert({ listing_source: 'runlime', slug: `e2e-checkin-${Date.now()}`, name, starts_at: new Date(Date.now() + 20 * 60_000).toISOString(), region_id: area!.id, venue_name: 'Savannah', start_lat: 10.67, start_lng: -61.51, registration_url: 'https://example.org/r', status: 'published', published_at: new Date().toISOString() })
    .select('id')
    .single();
  const near = await signedInUser('Near Runner');
  const far = await signedInUser('Far Runner');
  const later = await signedInUser('Later Runner');

  // In the window and inside 500 m: checked in. Location stored rounded to 3 decimals.
  expect((await near.client.rpc('check_in', { p_event: ev!.id, p_lat: 10.672, p_lng: -61.51, p_accuracy_m: 8 })).data.result).toBe('ok');
  // 1.7 km away: too far → help request.
  expect((await far.client.rpc('check_in', { p_event: ev!.id, p_lat: 10.6853, p_lng: -61.51, p_accuracy_m: 15 })).data.result).toBe('too_far');
  expect((await far.client.rpc('request_checkin_help', { p_event: ev!.id, p_note: 'At the registration tent' })).error).toBeNull();
  // 800 m away: too far (fixed later by a radius correction).
  expect((await later.client.rpc('check_in', { p_event: ev!.id, p_lat: 10.6772, p_lng: -61.51, p_accuracy_m: 10 })).data.result).toBe('too_far');

  const { ctx, page } = await signInAdmin(browser);
  await page.goto('/admin/checkins');
  const item = page.getByTestId('checkin-help').filter({ hasText: 'Far Runner' });
  await expect(item).toContainText(name);
  await expect(item).toContainText('Too far from the pin');
  await expect(item).toContainText('At the registration tent');
  await item.getByLabel('Reason for approving').fill('Confirmed by the race director');
  await item.getByRole('button', { name: 'Approve check-in' }).click();
  await expect(page.getByText('Checked in. The runner has been told.')).toBeVisible();

  // Race page: count, then widen the radius → the 800 m attempt is approved after correction.
  await page.goto(`/admin/events/${ev!.id}`);
  await expect(page.getByTestId('checkin-count')).toHaveText('2');
  // Owner decision (31 Oct): keyless "Open in Google Maps (satellite)" link beside the pin; new tab, no referrer.
  const sat = page.getByRole('link', { name: 'Open in Google Maps (satellite)' }).first();
  await expect(sat).toHaveAttribute('href', 'https://www.google.com/maps/@?api=1&map_action=map&center=10.670000%2C-61.510000&zoom=19&basemap=satellite');
  await expect(sat).toHaveAttribute('target', '_blank');
  await expect(sat).toHaveAttribute('rel', /noreferrer/);
  await page.getByLabel('Check-in radius in metres (empty = the standard setting)').fill('1000');
  await page.getByRole('button', { name: 'Save check-in area' }).click();
  await expect(page.getByText(/1 earlier failed check-in now passes and was approved after correction/)).toBeVisible();
  await ctx.close();

  const { data: mine } = await later.client.from('check_ins').select('status').eq('event_id', ev!.id).single();
  expect(mine!.status).toBe('approved_after_correction');
  const { data: farNote } = await far.client.from('notifications').select('title').eq('kind', 'checkin_update');
  expect(farNote![0]!.title).toBe(`You're checked in: ${name}`);
});
