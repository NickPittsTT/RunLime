import { PUSH_CHANNEL_ID, syncPushRegistration } from '@/lib/push';

const mockPerms = jest.fn();
const mockChannel = jest.fn(async () => null);
const mockToken = jest.fn(async () => ({ data: 'ExponentPushToken[abc123]' }));
const mockRpc = jest.fn(async () => ({ error: null as null | { message: string } }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockPerms(),
  setNotificationChannelAsync: (...a: unknown[]) => mockChannel(...(a as [])),
  getExpoPushTokenAsync: (...a: unknown[]) => mockToken(...(a as [])),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  setNotificationHandler: jest.fn(),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'proj-1' } } } }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: { openSettings: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(async () => undefined) }));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...(a as [])) } }));

describe('phone registration (owner retest 2026-10-18: no token after sign-out/in)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allowed: creates the high-importance channel and registers this phone with the EAS project token', async () => {
    mockPerms.mockResolvedValue({ granted: true });
    await expect(syncPushRegistration()).resolves.toBe('on');
    expect(mockChannel).toHaveBeenCalledWith(PUSH_CHANNEL_ID, expect.objectContaining({ importance: 4 }));
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
