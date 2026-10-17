import { devices, expect, test, type Page } from '@playwright/test';
import { admin, signInAdmin } from './helpers';

/** The map box must have real size and a drawing canvas (blank-map regression, owner re-test 2026-10-17). */
async function expectMapRendered(page: Page) {
  const map = page.locator('.maplibregl-map').first();
  await expect(page.locator('.maplibregl-canvas').first()).toBeAttached({ timeout: 15_000 });
  // The visible map box (it clips the canvas), not the canvas itself: that was 300 px while the box was 0 px.
  await expect.poll(async () => map.evaluate((el) => (el as HTMLElement).clientHeight), { timeout: 15_000 }).toBeGreaterThan(150);
  await expect.poll(async () => map.evaluate((el) => (el as HTMLElement).clientWidth)).toBeGreaterThan(200);
  // A tap in the middle of the map lands on the map canvas.
  await map.scrollIntoViewIfNeeded();
  const hit = await map.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) as HTMLElement | null)?.className ?? '';
  });
  expect(hit).toContain('maplibregl-canvas');
  await expect(page.getByTestId('map-attribution').first()).toBeVisible();
}

test('maps render on a phone: admin create-event form and the public race page', async ({ browser }) => {
  // Admin form on a phone-sized browser (where the owner saw a blank map).
  const { ctx: desk } = await signInAdmin(browser);
  const state = await desk.storageState();
  await desk.close();
  const phone = await browser.newContext({ ...devices['Pixel 7'], storageState: state });
  const page = await phone.newPage();
  await page.goto('/admin/events/new?type=runlime');
  await expectMapRendered(page);
  // Tapping the map places the start pin (fills the typed fields).
  await page.locator('.maplibregl-map').first().scrollIntoViewIfNeeded();
  const box = (await page.locator('.maplibregl-map').first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByLabel('Start latitude')).not.toHaveValue('');
  await phone.close();

  // Public race page.
  const db = admin();
  const { data: region } = await db.from('regions').select('id').eq('kind', 'area').limit(1).single();
  const slug = `e2e-map-${Date.now()}`;
  const { data: ev, error } = await db
    .from('events')
    .insert({
      listing_source: 'runlime', slug, name: `E2E Map Check ${Date.now()}`, starts_at: `${new Date().getUTCFullYear() + 1}-05-02T10:00:00Z`,
      region_id: region!.id, venue_name: 'Queen\'s Park Savannah', start_lat: 10.67, start_lng: -61.51,
      registration_url: 'https://example.org/map-check', status: 'published', organisation_id: null,
    })
    .select('id')
    .single();
  if (error) throw error;
  await db.from('event_distances').insert({ event_id: ev.id, distance_km: 5, label: '5K' });
  const anon = await browser.newContext({ ...devices['Pixel 7'] });
  const p2 = await anon.newPage();
  await p2.goto(`/e/${slug}`);
  await expectMapRendered(p2);
  await anon.close();
});
