import { PUSH_CHANNEL_ID, disablePushForThisPhone, retryPendingUnregister, syncPushRegistration } from '@/lib/push';

const mockPerms = jest.fn();
const mockChannel = jest.fn(async () => null);
const mockDeleteChannel = jest.fn(async () => undefined);
const mockToken = jest.fn(async () => ({ data: 'ExponentPushToken[abc123]' }));
const mockRpc = jest.fn(async () => ({ error: null as null | { message: string } }));
const mockStore = new Map<string, string>();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockPerms(),
  setNotificationChannelAsync: (...a: unknown[]) => mockChannel(...(a as [])),
  deleteNotificationChannelAsync: (...a: unknown[]) => mockDeleteChannel(...(a as [])),
  getExpoPushTokenAsync: (...a: unknown[]) => mockToken(...(a as [])),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  setNotificationHandler: jest.fn(),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'proj-1' } } } }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: { openSettings: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  removeItem: jest.fn(async (k: string) => void mockStore.delete(k)),
}));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...(a as [])) } }));

const unregisterCalls = () => mockRpc.mock.calls.filter((c) => (c as unknown[])[0] === 'unregister_push_token');

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  mockRpc.mockImplementation(async () => ({ error: null }));
  mockToken.mockImplementation(async () => ({ data: 'ExponentPushToken[abc123]' }));
});

describe('phone registration', () => {
  it('allowed: creates the loud channel (sound + banner), removes old channels, registers this phone with the EAS project token', async () => {
    mockPerms.mockResolvedValue({ granted: true });
    await expect(syncPushRegistration()).resolves.toBe('on');
    expect(PUSH_CHANNEL_ID).toBe('race-alerts');
    expect(mockChannel).toHaveBeenCalledWith('race-alerts', expect.objectContaining({ importance: 5, sound: 'default', enableVibrate: true }));
    expect(mockDeleteChannel).toHaveBeenCalledWith('race-updates');
    expect(mockToken).toHaveBeenCalledWith({ projectId: 'proj-1' });
    expect(mockRpc).toHaveBeenCalledWith('register_push_token', { p_token: 'ExponentPushToken[abc123]', p_platform: 'android' });
  });

  it('not allowed: never prompts and registers nothing', async () => {
    mockPerms.mockResolvedValue({ granted: false, canAskAgain: true });
    await expect(syncPushRegistration()).resolves.toBe('off');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('server refuses: reports "unavailable", not "on"', async () => {
    mockPerms.mockResolvedValue({ granted: true });
    mockRpc.mockResolvedValueOnce({ error: { message: 'nope' } });
    await expect(syncPushRegistration()).resolves.toBe('unavailable');
  });
});

describe('sign-out detaches the phone (owner retest B1)', () => {
  it('uses the stored token: no Expo call needed at sign-out', async () => {
    mockPerms.mockResolvedValue({ granted: true });
    await syncPushRegistration();
    mockToken.mockClear();
    mockToken.mockRejectedValue(new Error('offline'));
    await disablePushForThisPhone();
    expect(mockToken).not.toHaveBeenCalled();
    expect(unregisterCalls()).toEqual([['unregister_push_token', { p_token: 'ExponentPushToken[abc123]' }]]);
  });

  it('server unreachable: the removal is kept and retried later (signed out), until it succeeds', async () => {
    mockPerms.mockResolvedValue({ granted: true });
    await syncPushRegistration();
    mockRpc.mockImplementation(async () => ({ error: { message: 'network' } }));
    await disablePushForThisPhone();
    await retryPendingUnregister(); // still offline
    expect(unregisterCalls()).toHaveLength(2);
    mockRpc.mockImplementation(async () => ({ error: null }));
    await retryPendingUnregister(); // back online
    expect(unregisterCalls()).toHaveLength(3);
    await retryPendingUnregister(); // nothing left to retry
    expect(unregisterCalls()).toHaveLength(3);
  });

  it('a pending removal reaches the server before the phone is attached to the next account', async () => {
    mockPerms.mockResolvedValue({ granted: true });
    await syncPushRegistration();
    mockRpc.mockImplementation(async () => ({ error: { message: 'network' } }));
    await disablePushForThisPhone();
    mockRpc.mockImplementation(async () => ({ error: null }));
    await syncPushRegistration(); // next account signs in
    const names = mockRpc.mock.calls.map((c) => (c as unknown[])[0]);
    expect(names.lastIndexOf('unregister_push_token')).toBeLessThan(names.lastIndexOf('register_push_token'));
  });

  it('no token stored and none available: sign-out does nothing and never throws', async () => {
    mockToken.mockRejectedValue(new Error('no Firebase'));
    await expect(disablePushForThisPhone()).resolves.toBeUndefined();
    expect(unregisterCalls()).toHaveLength(0);
  });
});
