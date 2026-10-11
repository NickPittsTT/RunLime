import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRecentlyBlocked, runAgeGate, toIsoDate } from '../src/lib/ageGate';

describe('device age gate', () => {
  beforeEach(() => AsyncStorage.clear());

  it('builds ISO dates from separate inputs', () => {
    expect(toIsoDate('5', '3', '1990')).toBe('1990-03-05');
    expect(toIsoDate('', '3', '1990')).toBeNull();
    expect(toIsoDate('5', '3', '90')).toBeNull();
  });

  it('allows adults without recording anything', async () => {
    expect((await runAgeGate('1', '1', '1990')).status).toBe('allowed');
    expect(await isRecentlyBlocked()).toBe(false);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('blocks under-18s and stores only the time of the block (no date of birth)', async () => {
    const year = String(new Date().getFullYear() - 15);
    expect((await runAgeGate('10', '6', year)).status).toBe('blocked');
    expect(await isRecentlyBlocked()).toBe(true);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys).toEqual(['runlime.ageBlockedAt']);
    const stored = await AsyncStorage.getItem('runlime.ageBlockedAt');
    expect(stored).not.toContain(year);
  });

  it('block expires after 24 hours', async () => {
    const year = String(new Date().getFullYear() - 10);
    await runAgeGate('1', '1', year);
    expect(await isRecentlyBlocked(Date.now() + 25 * 60 * 60 * 1000)).toBe(false);
  });

  it('rejects impossible dates', async () => {
    expect((await runAgeGate('31', '2', '1990')).status).toBe('invalid');
  });
});
