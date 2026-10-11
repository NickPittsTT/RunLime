import { expect, test } from '@playwright/test';
import { countAuthUsersByEmail, passAgeGate, uniqueEmail } from './helpers';

test.describe('age gate (18+, hard rule) @mobile', () => {
  test('an under-18 is blocked before any sign-in method and nothing is stored', async ({ page }) => {
    await page.goto('/sign-in');
    // The date of birth is the first thing asked; no email field is shown yet.
    await expect(page.getByLabel('Email address')).toHaveCount(0);
    const today = new Date();
    const sixteen = new Date(Date.UTC(today.getUTCFullYear() - 16, 0, 15)).toISOString().slice(0, 10);
    await passAgeGate(page, sixteen);
    await expect(page.getByRole('heading', { name: /can.t create a RunLime account/ })).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveCount(0);

    // Reloading keeps the device-side block (no server record exists).
    await page.reload();
    await expect(page.getByRole('heading', { name: /can.t create a RunLime account/ })).toBeVisible();
  });

  test('the server rejects an under-18 sign-up even if the device gate is bypassed', async ({ request }) => {
    const email = uniqueEmail('bypass');
    const res = await request.post(`${process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'}/auth/v1/otp`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY!, 'content-type': 'application/json' },
      data: { email, create_user: true, data: { date_of_birth: '2012-01-01' } },
    });
    expect(res.status()).toBe(403);
    expect(await countAuthUsersByEmail(email)).toBe(0);
  });
});
