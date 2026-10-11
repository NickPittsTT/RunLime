import { defineConfig, devices } from '@playwright/test';

/**
 * Web E2E against a local Supabase stack (`supabase start`) and the Next.js app.
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, MAILPIT_URL (default http://127.0.0.1:54324).
 * In environments with a preinstalled Chromium, set PW_CHROMIUM_PATH.
 */
export default defineConfig({
  testDir: './web',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter @runlime/web start',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
