import { describe, expect, it } from 'vitest';
import { buildPushMessages, chunk, deadTokens } from '../../../supabase/functions/_shared/push';

const n = (id: string, user: string, title = 'Savannah 5K is postponed to Sat 15 Nov 2031, 6:30 am') => ({ id, user_id: user, kind: 'race_postponed', title, body: 'Heavy rain', data: { event_id: 'r1' } });

describe('push messages', () => {
  it('one message per notification per phone; people without phones get none', () => {
    const msgs = buildPushMessages([n('1', 'ana'), n('2', 'ben')], new Map([['ana', ['ExponentPushToken[a1]', 'ExponentPushToken[a2]']]]));
    expect(msgs.map((m) => m.to)).toEqual(['ExponentPushToken[a1]', 'ExponentPushToken[a2]']);
    expect(msgs[0]).toMatchObject({ title: 'Savannah 5K is postponed to Sat 15 Nov 2031, 6:30 am', body: 'Heavy rain', channelId: 'default', data: { event_id: 'r1', kind: 'race_postponed', notification_id: '1' } });
  });
  it('truncates long text for phone banners', () => {
    const [m] = buildPushMessages([{ ...n('1', 'ana', 'x'.repeat(300)), body: 'y'.repeat(900) }], new Map([['ana', ['t']]]));
    expect(m!.title).toHaveLength(120);
    expect(m!.body).toHaveLength(240);
  });
  it('batches of 100 (Expo limit)', () => {
    expect(chunk(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length)).toEqual([100, 100, 50]);
  });
  it('finds uninstalled phones from Expo tickets', () => {
    const msgs = buildPushMessages([n('1', 'ana')], new Map([['ana', ['ExponentPushToken[ok]', 'ExponentPushToken[gone]']]]));
    expect(deadTokens(msgs, [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }])).toEqual(['ExponentPushToken[gone]']);
  });
});
