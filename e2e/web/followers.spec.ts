import { expect, test } from '@playwright/test';
import { admin, signedInUser } from './helpers';

test('followers: private by default (request → approve → passport), block hides both ways', async () => {
  const db = admin();
  const ana = await signedInUser(`Follow Ana ${Date.now() % 100000}`);
  const ben = await signedInUser('Follow Ben');
  const { data: privacy } = await db.from('profiles').select('account_privacy').eq('id', ana.id).single();
  expect(privacy!.account_privacy).toBe('private');

  // Ben finds Ana and asks to follow: a request, no passport yet.
  const found = await ben.client.rpc('search_people', { p_query: 'Follow Ana' });
  expect((found.data as { id: string }[]).map((p) => p.id)).toContain(ana.id);
  expect((await ben.client.rpc('follow_user', { p_user: ana.id })).data).toBe('pending');
  expect((await ben.client.rpc('profile_passport', { p_user: ana.id })).error?.code).toBe('42501');
  const card = (await ben.client.rpc('profile_card', { p_user: ana.id })).data as Record<string, unknown>;
  expect(card).not.toHaveProperty('date_of_birth');
  expect(card).not.toHaveProperty('email');

  // Ana approves; Ben now sees her passport.
  const conns = (await ana.client.rpc('my_connections')).data as { requests: { id: string }[] };
  expect(conns.requests.map((r) => r.id)).toEqual([ben.id]);
  expect((await ana.client.rpc('respond_follow_request', { p_follower: ben.id, p_accept: true })).error).toBeNull();
  expect((await ben.client.rpc('profile_passport', { p_user: ana.id })).error).toBeNull();

  // Ana blocks Ben: follow removed, Ben can't find, see or request her.
  expect((await ana.client.rpc('block_user', { p_user: ben.id })).error).toBeNull();
  expect(((await ben.client.rpc('search_people', { p_query: 'Follow Ana' })).data as unknown[]).length).toBe(0);
  expect((await ben.client.rpc('profile_card', { p_user: ana.id })).error?.code).toBe('P0002');
  expect((await ben.client.rpc('follow_user', { p_user: ana.id })).error?.code).toBe('P0002');
  // Profiles stay unreadable directly (DOB etc.).
  expect(((await ben.client.from('profiles').select('date_of_birth').eq('id', ana.id)).data ?? []).length).toBe(0);
});
