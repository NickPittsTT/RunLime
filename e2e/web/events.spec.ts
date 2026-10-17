import { expect, test, type Browser } from '@playwright/test';
import { admin, createUserWithProfile, currentTotp, signInWithEmail, uniqueEmail } from './helpers';

const nextYear = new Date().getUTCFullYear() + 1;
const START_LOCAL = `${nextYear}-03-07T06:00`;
const MONTH = `${nextYear}-03`;

async function signInAdmin(browser: Browser) {
  const email = uniqueEmail('admin');
  await createUserWithProfile(email, 'Ada Admin', 'platform_admin');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signInWithEmail(page, email, '1985-02-02', '/admin');
  await expect(page).toHaveURL(/\/admin\/mfa/);
  const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
  await page.getByLabel('Authenticator code').fill(currentTotp(secret));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'Admin overview' })).toBeVisible();
  return { ctx, page };
}

test('admin enters a RunLime listing; the public sees facts + the not-affiliated notice', async ({ browser }) => {
  const { ctx, page } = await signInAdmin(browser);
  await page.goto('/admin/events/new?type=runlime');
  await expect(page.getByText('RunLime listing.', { exact: false })).toBeVisible();
  const name = `E2E Savannah Sunrise ${Date.now()}`;
  await page.getByLabel('Race name').fill(name);
  await page.getByLabel('Date and start time (Trinidad and Tobago time)').fill(START_LOCAL);
  await page.getByLabel('Area').selectOption({ label: 'Port of Spain & North-West' });
  await page.getByLabel('Venue / start location').fill("Queen's Park Savannah");
  await page.getByLabel('Start latitude').fill('10.6702');
  await page.getByLabel('Start longitude').fill('-61.5106');
  // No flyer/description/fee fields for a fact-only listing.
  await expect(page.getByLabel('Description (optional)')).toHaveCount(0);
  await expect(page.getByLabel('Entry fee from (TT$)')).toHaveCount(0);
  await page.getByLabel('Official registration link (required)').fill('https://example.org/savannah-sunrise');
  await page.getByRole('button', { name: 'Save listing' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Published.')).toBeVisible();

  // Public (signed-out) view.
  const anon = await browser.newPage();
  await anon.goto(`/races?month=${MONTH}`);
  await anon.getByRole('link', { name }).click();
  await expect(anon.getByRole('heading', { name })).toBeVisible();
  await expect(anon.getByText('not affiliated', { exact: false })).toBeVisible();
  await expect(anon.getByText('Children:', { exact: false })).toBeVisible();
  // Map credit is visible text on the map (OSM licence), not hidden behind a button.
  const credit = anon.getByTestId('map-attribution');
  await expect(credit).toBeVisible();
  await expect(credit.getByRole('link', { name: '© OpenStreetMap contributors' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  await expect(credit.getByRole('link', { name: 'OpenFreeMap' })).toBeVisible();
  await expect(anon.getByRole('link', { name: /Register with the organiser/ })).toHaveAttribute('href', 'https://example.org/savannah-sunrise');
  const ics = await anon.request.get(`${new URL(anon.url()).pathname}/calendar.ics`);
  expect(ics.status()).toBe(200);
  expect(await ics.text()).toContain(`SUMMARY:${name}`);
  await anon.close();
  await ctx.close();
});

test('verified organiser drafts, submits; admin approves; organiser postpones with a reason', async ({ browser }) => {
  // Verified organisation set up directly (the application flow itself is covered in organiser-admin.spec).
  const db = admin();
  const orgEmail = uniqueEmail('org');
  const ownerId = await createUserWithProfile(orgEmail, 'Ola Organiser');
  const { data: org, error } = await db
    .from('organisations')
    .insert({ name: `E2E Runners ${Date.now()}`, slug: `e2e-runners-${Date.now()}`, contact_email: 'runners@example.org', contact_phone: '868-555-0100', about: 'Community 5Ks in Central Trinidad since 2012.', status: 'verified' })
    .select('id')
    .single();
  if (error) throw error;
  await db.from('organisation_members').insert({ organisation_id: org.id, user_id: ownerId, role: 'owner' });
  await db.from('user_roles').insert({ user_id: ownerId, role: 'organiser' });

  const oCtx = await browser.newContext();
  const o = await oCtx.newPage();
  await signInWithEmail(o, orgEmail, '1985-02-02', '/organiser');
  await o.getByRole('link', { name: 'New event' }).click();
  const name = `E2E Chaguanas Charity 5K ${Date.now()}`;
  await o.getByLabel('Race name').fill(name);
  await o.getByLabel('Date and start time (Trinidad and Tobago time)').fill(START_LOCAL);
  await o.getByLabel('Area').selectOption({ label: 'Central' });
  await o.getByLabel('Venue / start location').fill('Chaguanas Borough Corporation grounds');
  await o.getByLabel('Start latitude').fill('10.5168');
  await o.getByLabel('Start longitude').fill('-61.4114');
  await o.getByLabel('Entry fee from (TT$)').fill('100');
  await o.getByLabel('Cause (optional)').fill('Children’s hospital');
  await o.getByRole('button', { name: 'Save draft' }).click();
  await expect(o.getByText('Saved.')).toBeVisible();
  await expect(o.getByText('Draft: only you and your team can see it.')).toBeVisible();
  await o.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(o.getByText('Submitted.', { exact: false })).toBeVisible();

  const { ctx: aCtx, page: a } = await signInAdmin(browser);
  await a.goto('/admin/events?status=pending_approval');
  await a.getByRole('link', { name }).click();
  await a.getByRole('button', { name: 'Reject' }).click();
  await expect(a.getByText('Please give a reason', { exact: false })).toBeVisible();
  await a.getByRole('button', { name: 'Publish' }).click();
  await expect(a.getByText('Published.')).toBeVisible();

  await o.reload();
  await expect(o.getByText('Live on the RunLime calendar.')).toBeVisible();
  await o.getByLabel('Change').selectOption('postponed');
  await o.getByLabel('Reason runners will see').fill('Heavy rain forecast for the weekend');
  await o.getByRole('button', { name: 'Update status' }).click();
  await expect(o.getByText('The event is now postponed.')).toBeVisible();

  const anon = await browser.newPage();
  await anon.goto(`/races?month=${MONTH}`);
  await anon.getByRole('link', { name }).click();
  await expect(anon.getByText('Postponed.', { exact: false })).toBeVisible();
  await expect(anon.getByText('Heavy rain forecast for the weekend')).toBeVisible();
  await expect(anon.getByText('not affiliated', { exact: false })).toHaveCount(0);
  await anon.close();
  await oCtx.close();
  await aCtx.close();
});
