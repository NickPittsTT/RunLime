import { expect, test, type Page } from '@playwright/test';
import { CALENDAR_COLUMNS } from '../../packages/shared/src/events';
import { SUPABASE_URL, createUserWithProfile, signInAdmin, uniqueEmail } from './helpers';

const nextYear = new Date().getUTCFullYear() + 1;
const START_LOCAL = `${nextYear}-04-11T06:00`;
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');

/** The exact query the mobile app makes for the calendar (anon key; public data). */
async function appSeesStatus(name: string): Promise<string | undefined> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/events`);
  url.searchParams.set('select', CALENDAR_COLUMNS.replace(/\s+/g, ''));
  url.searchParams.set('name', `eq.${name}`);
  url.searchParams.set('status', 'in.(published,postponed,cancelled)');
  const key = process.env.SUPABASE_ANON_KEY!;
  const rows = (await (await fetch(url, { headers: { apikey: key, authorization: `Bearer ${key}` } })).json()) as { status: string }[];
  return rows[0]?.status;
}

async function createPublishedListing(page: Page, name: string) {
  await page.goto('/admin/events');
  // Item 3: the listing is the obvious first action, separate from organiser events.
  await expect(page.getByRole('heading', { name: 'Add a race you found' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Organiser events (less common)' })).toBeVisible();
  await page.getByRole('link', { name: 'New RunLime listing' }).click();
  await page.getByLabel('Race name').fill(name);
  await page.getByLabel('Date and start time (Trinidad and Tobago time)').fill(START_LOCAL);
  await page.getByLabel('Area').selectOption({ label: 'Port of Spain & North-West' });
  await page.getByLabel('Venue / start location').fill('Hayes Street, Port of Spain');
  await page.getByLabel('Start latitude').fill('10.6644');
  await page.getByLabel('Start longitude').fill('-61.5199');
  await page.getByLabel('Official registration link (required)').fill('https://example.org/pscu-5k');
  await page.getByRole('button', { name: 'Save listing' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Published.')).toBeVisible();
}

test('postponed and cancelled stay that way: no Publish button undoes them, and the app sees each change', async ({ browser }) => {
  const { ctx, page } = await signInAdmin(browser);
  const name = `E2E PSCU 5K ${Date.now()}`;
  await createPublishedListing(page, name);
  expect(await appSeesStatus(name)).toBe('published');

  await page.getByLabel('Change').selectOption('postponed');
  // Reason box: minimum shown up front, live count, clear error if too short (nothing is sent).
  const reason = page.getByLabel('Reason runners will see');
  await expect(reason).toHaveAttribute('placeholder', 'Minimum 5 characters');
  await reason.fill('Rain');
  await expect(page.getByText('4 / 500 characters · minimum 5')).toBeVisible();
  await page.getByRole('button', { name: 'Update status' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please give a reason of at least 5 characters (you have 4).' })).toBeVisible();
  expect(await appSeesStatus(name)).toBe('published');
  await reason.fill('Heavy rain forecast');
  await page.getByRole('button', { name: 'Update status' }).click();
  await expect(page.getByText('The event is now postponed.')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('event-status')).toContainText('Status: Postponed');
  await expect(page.getByTestId('event-status')).toContainText('Heavy rain forecast');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0); // the root cause of the failed test
  expect(await appSeesStatus(name)).toBe('postponed');

  await page.getByLabel('Change').selectOption('cancelled');
  await page.getByLabel('Reason runners will see').fill('Venue unavailable');
  await page.getByRole('button', { name: 'Update status' }).click();
  await expect(page.getByText('The event is now cancelled.')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('event-status')).toContainText('Status: Cancelled');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0);
  expect(await appSeesStatus(name)).toBe('cancelled');

  // Putting it back on is a deliberate, separate choice.
  await page.getByLabel('Change').selectOption('published');
  await page.getByRole('button', { name: 'Update status' }).click();
  await expect(page.getByText('The event is back on.')).toBeVisible();
  expect(await appSeesStatus(name)).toBe('published');
  await ctx.close();
});

test('admin adds a verified organisation for an organiser they signed up; it can be chosen for organiser events', async ({ browser }) => {
  const ownerEmail = uniqueEmail('pscu');
  await createUserWithProfile(ownerEmail, 'Pat Organiser');
  const { ctx, page } = await signInAdmin(browser);
  await page.goto('/admin/organisers');
  await page.getByRole('link', { name: 'Add organisation' }).click();
  const orgName = `E2E Credit Union ${Date.now()}`;
  await page.getByLabel('Organisation name').fill(orgName);
  await page.getByLabel('Contact email').fill('events@cu.example');
  await page.getByLabel('Contact phone').fill('868-555-0199');
  await page.getByLabel('About the organisation').fill('Credit union that organises an anniversary 5K each year.');
  await page.getByLabel("Organiser's RunLime account email (optional)").fill(ownerEmail);
  await page.getByRole('button', { name: 'Create verified organisation' }).click();
  await expect(page.getByText('Organisation created and verified.')).toBeVisible();
  await expect(page.getByRole('heading', { name: orgName })).toBeVisible();

  await page.goto('/admin/events/new?type=organiser');
  await expect(page.getByText('Only verified organisations are listed.')).toBeVisible();
  await expect(page.getByLabel('Organisation').locator('option', { hasText: orgName })).toHaveCount(1);
  await ctx.close();
});

test('a RunLime listing shows the organiser flyer only after the permission tick', async ({ browser }) => {
  const { ctx, page } = await signInAdmin(browser);
  const name = `E2E Flyer Listing ${Date.now()}`;
  await createPublishedListing(page, name);
  await expect(page.getByRole('heading', { name: "Organiser's flyer and sponsors" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add image' })).toHaveCount(0);
  await page.getByLabel("I have the organiser's permission to use this image", { exact: false }).check();
  await page.getByRole('button', { name: 'Save permission' }).click();
  await expect(page.getByText('Permission recorded.', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Recorded .* Who ticked it is in the audit log\./)).toBeVisible();
  // Photos stay organiser-only for listings.
  await expect(page.getByLabel('Type').locator('option', { hasText: 'Photo' })).toHaveCount(0);
  await page.getByLabel('Image (JPG, PNG or WebP, up to 5 MB)').setInputFiles({ name: 'flyer.png', mimeType: 'image/png', buffer: PNG_1PX });
  await page.getByLabel('Describe the image (alt text, required)').fill('PSCU 5K flyer: 6am start, Hayes Street');
  await page.getByRole('button', { name: 'Add image' }).click();
  await expect(page.getByText('Image added.')).toBeVisible();

  const anon = await browser.newPage();
  await anon.goto(`/races?month=${nextYear}-04`);
  await anon.getByRole('link', { name }).click();
  await expect(anon.getByRole('img', { name: 'PSCU 5K flyer: 6am start, Hayes Street' })).toBeVisible();
  await anon.close();
  await ctx.close();
});
