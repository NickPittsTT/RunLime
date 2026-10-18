import { expect, test } from '@playwright/test';
import { SUPABASE_URL, admin, signedInUser } from './helpers';

test('RSVP set in the app is counted: public sees adults going (never children); the runner sees it in My races', async ({ page }) => {
  // A published RunLime listing next month.
  const db = admin();
  const { data: area } = await db.from('regions').select('id').eq('kind', 'area').limit(1).single();
  const slug = `e2e-rsvp-${Date.now()}`;
  const startsAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const { data: ev, error } = await db
    .from('events')
    .insert({ listing_source: 'runlime', slug, name: `E2E RSVP 5K ${Date.now()}`, starts_at: startsAt, region_id: area!.id, venue_name: 'Queen’s Park Savannah', start_lat: 10.67, start_lng: -61.51, registration_url: 'https://example.org/r', status: 'published', published_at: new Date().toISOString() })
    .select('id')
    .single();
  expect(error).toBeNull();

  // Two runners RSVP from the app (same RPC the app calls).
  const ana = await signedInUser('RSVP Ana');
  const ben = await signedInUser('RSVP Ben');
  expect((await ana.client.rpc('set_rsvp', { p_event: ev!.id, p_status: 'going', p_adults: 2, p_children: 3 })).error).toBeNull();
  expect((await ben.client.rpc('set_rsvp', { p_event: ev!.id, p_status: 'maybe', p_adults: 1, p_children: 0 })).error).toBeNull();

  // What the app shows on cards (anon count): 2 going (adults), 1 maybe; children never exposed.
  const anon = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rsvp_counts`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ p_events: [ev!.id] }),
  });
  expect(await anon.json()).toEqual([{ event_id: ev!.id, going: 2, maybe: 1 }]);

  // Ana's "My races" query returns the race with her group; Ben cannot see Ana's RSVP.
  const mine = await ana.client.from('rsvps').select('status, adults, children, events(id, name)').in('status', ['going', 'maybe']);
  expect(mine.data).toEqual([expect.objectContaining({ status: 'going', adults: 2, children: 3 })]);
  const peek = await ben.client.from('rsvps').select('user_id').eq('event_id', ev!.id);
  expect(peek.data).toHaveLength(1); // only his own row

  // Public race page.
  await page.goto(`/e/${slug}`);
  await expect(page.getByTestId('going-count')).toContainText('2 going · 1 maybe');
  await expect(page.getByText(/3 child/)).toHaveCount(0);
});
