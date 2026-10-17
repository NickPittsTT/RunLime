import { createClient } from '@supabase/supabase-js';
import { expect, type Browser, type Page } from '@playwright/test';
import { totp } from '../../scripts/lib/totp';

export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

export function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for E2E');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@e2e.runlime.test`;
}

export async function countAuthUsersByEmail(email: string): Promise<number> {
  const { data, error } = await admin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.filter((u) => u.email === email).length;
}

/** Waits for the newest sign-in email for `email` in Mailpit and returns the 6-digit code. */
export async function readOtp(email: string, notBefore: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const body = (await res.json()) as { messages?: { ID: string; Created: string }[] };
    const msg = body.messages?.find((m) => new Date(m.Created).getTime() >= notBefore - 2000);
    if (msg) {
      const full = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`)).json()) as { Text: string; HTML: string };
      const code = /\b(\d{6})\b/.exec(full.Text || full.HTML)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No OTP email for ${email}`);
}

export async function passAgeGate(page: Page, dob: string) {
  await page.getByLabel('What is your date of birth?').fill(dob);
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Full web sign-in through the UI: age gate → email → code. */
export async function signInWithEmail(page: Page, email: string, dob = '1990-06-15', next = '/account') {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await passAgeGate(page, dob);
  const sentAt = Date.now();
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByText('We sent a code to')).toBeVisible();
  await page.getByLabel('6-digit code').fill(await readOtp(email, sentAt));
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function completeProfile(page: Page, displayName: string, area = 'Central') {
  await expect(page.getByRole('heading', { name: 'Finish setting up' })).toBeVisible();
  await page.getByLabel('Display name').fill(displayName);
  await page.getByLabel('Home area').selectOption({ label: area });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create my account' }).click();
}

/** Creates an adult user with a profile directly (service role), optionally with a role. */
export async function createUserWithProfile(email: string, displayName: string, role?: 'platform_admin' | 'super_admin') {
  const db = admin();
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const { data: area } = await db.from('regions').select('id').eq('kind', 'area').limit(1).single();
  const { error: pErr } = await db.from('profiles').insert({ id: data.user.id, display_name: displayName, date_of_birth: '1985-02-02', home_region_id: area!.id });
  if (pErr) throw pErr;
  await db.from('user_roles').insert([{ user_id: data.user.id, role: 'participant' }, ...(role ? [{ user_id: data.user.id, role }] : [])]);
  return data.user.id;
}

export function currentTotp(secret: string) {
  return totp(secret);
}

/** A platform admin signed in with TOTP (aal2) in a fresh browser context. */
export async function signInAdmin(browser: Browser) {
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
