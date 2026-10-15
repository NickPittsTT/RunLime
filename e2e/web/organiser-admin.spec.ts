import { expect, test } from '@playwright/test';
import { completeProfile, createUserWithProfile, currentTotp, signInWithEmail, uniqueEmail } from './helpers';

test('organiser applies; admin enrols MFA and approves; organiser becomes verified', async ({ browser }) => {
  // 1. Organiser applies
  const organiserCtx = await browser.newContext();
  const organiser = await organiserCtx.newPage();
  const orgEmail = uniqueEmail('organiser');
  await signInWithEmail(organiser, orgEmail, '1980-01-01', '/organiser');
  await completeProfile(organiser, 'Olu Organiser', 'South');
  await expect(organiser.getByRole('heading', { name: 'Apply for an organiser account' })).toBeVisible();
  const orgName = `E2E Harriers ${Date.now()}`;
  await organiser.getByLabel('Organisation or race name').fill(orgName);
  await organiser.getByLabel('Contact email for runners').fill('races@e2e-harriers.example');
  await organiser.getByLabel('Contact phone').fill('+1 868 555 0142');
  await organiser.getByLabel('About your organisation and races').fill('We have organised community 5Ks in South Trinidad since 2015.');
  await organiser.getByRole('button', { name: 'Submit application' }).click();
  await expect(organiser.getByText('Your application is waiting for review')).toBeVisible();

  // 2. Admin without MFA is sent to enrol; enrols TOTP; then approves
  const adminEmail = uniqueEmail('admin');
  await createUserWithProfile(adminEmail, 'Eve Admin', 'platform_admin');
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await signInWithEmail(admin, adminEmail, '1985-02-02', '/admin');
  await expect(admin).toHaveURL(/\/admin\/mfa/);
  const secret = (await admin.getByTestId('totp-secret').textContent())!.trim();
  await admin.getByLabel('Authenticator code').fill(currentTotp(secret));
  await admin.getByRole('button', { name: 'Verify' }).click();
  await expect(admin.getByRole('heading', { name: 'Admin overview' })).toBeVisible();
  await expect(admin.getByText('MFA verified')).toBeVisible();

  await admin.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Organisers' }).click();
  const card = admin.locator('article', { hasText: orgName });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Reject' }).click();
  await expect(card.getByText('Please give a reason')).toBeVisible();
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.locator('article', { hasText: orgName })).toHaveCount(0);

  // 3. Organiser sees verified status
  await organiser.reload();
  await expect(organiser.getByText('Verified organiser.', { exact: false })).toBeVisible();

  // 4. Admin creates a club (F4)
  await admin.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Clubs' }).click();
  const club = `E2E Striders ${Date.now()}`;
  await admin.getByLabel('Club name').first().fill(club);
  await admin.getByRole('button', { name: 'Create club' }).click();
  await expect(admin.getByText('Club created.')).toBeVisible();
  await expect(admin.getByText(`${club} · 0 members`)).toBeVisible();

  // 5. A platform admin cannot grant admin roles (super admin only)
  await admin.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Users' }).click();
  await expect(admin.getByRole('button', { name: /Make .* platform admin/ })).toHaveCount(0);

  await organiserCtx.close();
  await adminCtx.close();
});

test('participant cannot open the admin console', async ({ page }) => {
  const email = uniqueEmail('nosy');
  await signInWithEmail(page, email, '1993-03-03', '/admin');
  await completeProfile(page, 'Nosy Parker');
  // After sign-up the app continues to /admin, which sends a participant to their account page.
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('link', { name: 'Admin console' })).toHaveCount(0);
});
