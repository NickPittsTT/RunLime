import { createClient } from '@supabase/supabase-js';
import { expect, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
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
export async function signInAdmin(browser: Browser, contextOptions: BrowserContextOptions = {}) {
  const email = uniqueEmail('admin');
  await createUserWithProfile(email, 'Ada Admin', 'platform_admin');
  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();
  await signInWithEmail(page, email, '1985-02-02', '/admin');
  await expect(page).toHaveURL(/\/admin\/mfa/);
  const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
  await page.getByLabel('Authenticator code').fill(currentTotp(secret));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'Admin overview' })).toBeVisible();
  return { ctx, page };
}

/** A user with a password (for API-level steps such as uploading a photo), signed in with the anon key. */
export async function signedInUser(displayName: string) {
  const email = uniqueEmail(displayName.toLowerCase().replace(/\W+/g, '-'));
  const password = `E2e-${Math.random().toString(36).slice(2)}-pw!`;
  const db = admin();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const { data: area } = await db.from('regions').select('id').eq('kind', 'area').limit(1).single();
  await db.from('profiles').insert({ id: data.user.id, display_name: displayName, date_of_birth: '1988-03-03', home_region_id: area!.id });
  await db.from('user_roles').insert({ user_id: data.user.id, role: 'participant' });
  const client = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  return { id: data.user.id, client, token: s.session!.access_token };
}

/** A real 96x96 JPEG carrying GPS EXIF data and a comment ("home address"), as a phone photo would. */
export const PHOTO_WITH_GPS = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/4QCgRXhpZgAATU0AKgAAAAgAAgEPAAIAAAALAAAAJoglAAQAAAABAAAAMgAAAABQaG9uZU1ha2VyAAAABAABAAIAAAACTgAAAAACAAUAAAADAAAAaAADAAIAAAACVwAAAAAEAAUAAAADAAAAgAAAAAAAAAAKAAAAAQAAACcAAAABAAAFCwAAABkAAAA9AAAAAQAAAB8AAAABAAABIwAAABn//gAOaG9tZSBhZGRyZXNz/9sAQwAKBwcIBwYKCAgICwoKCw4YEA4NDQ4dFRYRGCMfJSQiHyIhJis3LyYpNCkhIjBBMTQ5Oz4+PiUuRElDPEg3PT47/9sAQwEKCwsODQ4cEBAcOygiKDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7/8AAEQgAYABgAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A26KKK+APOCiiigAooooAKKKKACiiigAooooAKKKKACiiorm5hs7dri4fZGmNzYJxk47fWmk27ICWisv/AISXR/8An7/8hv8A4Uf8JLo//P3/AOQ3/wAK2+rV/wCR/cxXRqUVl/8ACS6P/wA/f/kN/wDCj/hJdH/5+/8AyG/+FH1av/I/uYXRqUVFbXMN5brcW7743ztbBGcHHf6VLWLTTsxhRRRSAKKKKACsvxL/AMgC5/4B/wChitSsvxL/AMgC5/4B/wChit8N/Hh6r8xPY4KiiivsjMKKKKAO98Nf8gC2/wCB/wDoZrUrL8Nf8gC2/wCB/wDoZrUr43E/x5+r/M0WwUUUVgMKKKKACsvxL/yALn/gH/oYrUrL8S/8gC5/4B/6GK3w38eHqvzE9jgqKKK+yMwooooA73w1/wAgC2/4H/6Ga1Ky/DX/ACALb/gf/oZrUr43E/x5+r/M0WwUUUVgMKKKKACorm2hvLdre4TfG+Ny5Izg57fSpaKabTugMv8A4RrR/wDn0/8AIj/40f8ACNaP/wA+n/kR/wDGtSitvrNf+d/exWRl/wDCNaP/AM+n/kR/8aP+Ea0f/n0/8iP/AI1qUUfWa/8AO/vYWRFbW0Nnbrb26bI0ztXJOMnPf61LRRWLbbuxhRRRSAKKKKACiiigAooooAKKKKACiiigAooooA//2Q==', 'base64');
