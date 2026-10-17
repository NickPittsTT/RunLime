import { expect, test } from '@playwright/test';
import { completeProfile, countAuthUsersByEmail, signInWithEmail, uniqueEmail } from './helpers';

test('adult signs up with an email code, downloads their data and deletes their account @mobile', async ({ page }) => {
  const email = uniqueEmail('adult');
  await signInWithEmail(page, email, '1992-04-20', '/account');
  await completeProfile(page, 'Kezia Runner', 'Tobago');

  await expect(page.getByRole('heading', { name: 'Hi, Kezia Runner' })).toBeVisible();
  await expect(page.getByText('Tobago')).toBeVisible();
  await expect(page.getByText('Private')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download my data' }).click();
  const file = await download;
  const content = JSON.parse(await (await file.createReadStream())!.toArray().then((c) => Buffer.concat(c).toString('utf8')));
  expect(content.profile.display_name).toBe('Kezia Runner');
  expect(content.profile.date_of_birth).toBe('1992-04-20');
  expect(content.consents.map((c: { kind: string }) => c.kind).sort()).toEqual(['privacy', 'terms']);

  await page.getByRole('link', { name: 'Delete my account' }).click();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByText('Your RunLime account has been deleted.')).toBeVisible();
  expect(await countAuthUsersByEmail(email)).toBe(0);
});

test('legal pages are public and marked as drafts', async ({ page }) => {
  for (const [path, heading] of [
    ['/legal/privacy', 'RunLime Privacy Policy'],
    ['/legal/terms', 'RunLime Terms of Use'],
    ['/legal/child-safety', 'RunLime Child Safety Policy (CSAE Standards)'],
    ['/legal/moderation', 'RunLime Moderation Policy'],
    ['/legal/health', 'Health Disclaimer'],
    ['/legal/community-times', 'Community Times'],
    ['/legal/refunds', 'RunLime Refund Policy'],
    ['/support', 'RunLime Support'],
    ['/delete-account', 'Delete your RunLime account'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();
  }
  // Markdown tables render as real tables (not raw pipe text).
  await page.goto('/legal/privacy');
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Account and profile' })).toBeVisible();
  await expect(page.getByText('| Data |')).toHaveCount(0);
  await expect(page.getByText('Cloudflare (website hosting)')).toBeVisible();
  await expect(page.getByText(/only cookie the website sets is the sign-in cookie/)).toBeVisible();
  await page.goto('/legal/terms');
  await expect(page.getByText(/must be accompanied by a parent or guardian/)).toBeVisible();
  await page.goto('/legal/refunds');
  await expect(page.getByRole('cell', { name: /We reject your listing/ })).toBeVisible();
  await expect(page.getByText(/within 10 business days/)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Refunds' })).toBeVisible();
  const res = await page.goto('/legal/not-a-page');
  expect(res?.status()).toBe(404);
});

test('signed-out visitors are sent to sign in for protected areas', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin/);
});
