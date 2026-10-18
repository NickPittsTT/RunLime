import { devices, expect, test } from '@playwright/test';
import { PHOTO_WITH_GPS, SUPABASE_URL, admin, signInAdmin, signedInUser } from './helpers';

const fn = (token: string, init: RequestInit) =>
  fetch(`${SUPABASE_URL}/functions/v1/profile-photo`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });

test('profile photo: location data is stripped; a reported photo is removed from the admin queue on a phone', async ({ browser }) => {
  // A runner sets a photo straight from their phone: the stored file has no EXIF/GPS or comment.
  const name = `Photo Runner ${Date.now() % 1_000_000}`;
  const runner = await signedInUser(name);
  expect(PHOTO_WITH_GPS.includes(Buffer.from('Exif'))).toBe(true);
  const up = await fn(runner.token, { method: 'POST', body: PHOTO_WITH_GPS, headers: { 'content-type': 'image/jpeg' } });
  expect(up.status).toBe(200);
  const { path } = (await up.json()) as { path: string };
  const served = Buffer.from(await (await fetch(`${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`)).arrayBuffer());
  expect(served.subarray(0, 2).toString('hex')).toBe('ffd8');
  expect(served.includes(Buffer.from('Exif'))).toBe(false);
  expect(served.includes(Buffer.from('home address'))).toBe(false);

  // Another runner reports the photo; someone also reports a child-safety concern.
  const reporter = await signedInUser('Careful Reporter');
  const photoReport = await reporter.client.rpc('submit_report', { p_category: 'sexual_content', p_target_kind: 'profile_photo', p_target_user: runner.id, p_target_ref: null, p_details: 'Not a running photo' });
  expect(photoReport.error).toBeNull();
  const concernText = `E2E ${Date.now()}: an adult asked for photos of children at a race`;
  const safety = await reporter.client.rpc('submit_report', {
    p_category: 'child_safety', p_target_kind: 'general', p_target_user: null, p_target_ref: null,
    p_details: concernText,
  });
  expect(safety.error).toBeNull();

  // Admin on a phone-sized screen: child safety first; remove the photo.
  const { ctx, page } = await signInAdmin(browser, { ...devices['Pixel 7'] });
  await page.goto('/admin/reports');
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  // Admin alerts: the menu shows open reports (red while a child-safety report is open) …
  await expect(page.getByTestId('open-reports')).toBeVisible();
  await expect(page.getByTestId('open-reports')).toHaveClass(/bg-danger/);
  // … and every admin got a bell notification at once (no names in it).
  const { data: alerts } = await admin().from('notifications').select('title, data').eq('kind', 'report_received').eq('data->>report_id', safety.data as string);
  expect(alerts!.length).toBeGreaterThan(0);
  expect(alerts![0]!.title).toBe('Urgent report: a child may be at risk');
  await expect(page.getByTestId('report').first()).toContainText('A child may be at risk');
  const item = page.getByTestId('report').filter({ hasText: name });
  await expect(item.getByRole('img', { name: `Reported profile photo of ${name}` })).toBeVisible();
  const box = await item.getByRole('button', { name: 'Remove photo' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44); // touch target
  await item.getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByText('Photo removed and the report closed.')).toBeVisible();
  const { data: prof } = await admin().from('profiles').select('avatar_path').eq('id', runner.id).single();
  expect(prof!.avatar_path).toBeNull();
  expect((await fetch(`${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`)).ok).toBe(false); // the file is gone
  await page.getByRole('link', { name: 'Handled' }).click();
  await expect(page.getByTestId('report').filter({ hasText: name })).toContainText('Photo removed');

  // Dismiss the safety report with a note.
  await page.goto('/admin/reports');
  const concern = page.getByTestId('report').filter({ hasText: concernText });
  await concern.getByLabel('Note (kept in the history)').fill('Checked with the organiser');
  await concern.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText('Report dismissed.')).toBeVisible();
  await ctx.close();

  // A non-admin cannot use the admin removal.
  const denied = await fn(reporter.token, { method: 'POST', body: JSON.stringify({ action: 'admin_remove', userId: runner.id }), headers: { 'content-type': 'application/json' } });
  expect(denied.status).toBe(403);
});
