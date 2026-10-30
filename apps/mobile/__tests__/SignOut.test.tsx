import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { forgetGoogleAccount, signInWithGoogle } from '@/lib/socialSignIn';
import { SessionProvider, useSession } from '@/state/session';

const mockOrder: string[] = [];
const mockDisable = jest.fn(async () => void mockOrder.push('detach phone'));
const mockRetry = jest.fn(async () => undefined);
const mockAuthSignOut = jest.fn(async () => (mockOrder.push('end session'), { error: null }));
jest.mock('@/lib/push', () => ({
  disablePushForThisPhone: () => mockDisable(),
  retryPendingUnregister: () => mockRetry(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signOut: () => mockAuthSignOut(),
      signInWithIdToken: jest.fn(async () => ({ error: null })),
    },
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
  },
}));
const mockGoogleSignOut = jest.fn(async () => void mockOrder.push('forget Google account'));
const mockGoogleSignIn = jest.fn(async () => (mockOrder.push('Google chooser'), { type: 'success', data: { idToken: 'id-token' } }));
jest.mock('@/lib/googleSigninModule', () => ({ loadGoogleSignin: async () => mockGoogleModule }));
const mockGoogleModule = {
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signOut: () => mockGoogleSignOut(),
    signIn: () => mockGoogleSignIn(),
  },
  isErrorWithCode: () => false,
  statusCodes: {},
};
jest.mock('@/lib/config', () => ({ config: { googleWebClientId: 'web', googleIosClientId: 'ios' } }));

let signOut: () => Promise<void> = async () => undefined;
function Probe() {
  const session = useSession();
  useEffect(() => {
    signOut = session.signOut;
  });
  return <Text>probe</Text>;
}

beforeEach(() => {
  mockOrder.length = 0;
  jest.clearAllMocks();
});

describe('signing out (owner retest B1 + B6)', () => {
  it('detaches the phone, forgets the Google account, then ends the session; a pending removal is retried at start', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(mockRetry).toHaveBeenCalled();
    await act(() => signOut());
    expect(mockOrder).toEqual(['detach phone', 'forget Google account', 'end session']);
  });

  it('a Google sign-out that hangs or fails never blocks signing out', async () => {
    jest.useFakeTimers();
    mockGoogleSignOut.mockImplementationOnce(() => new Promise(() => undefined)); // never resolves
    const done = forgetGoogleAccount();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(3000);
    await expect(done).resolves.toBeUndefined();
    jest.useRealTimers();
    mockGoogleSignOut.mockRejectedValueOnce(new Error('no Google services'));
    await expect(forgetGoogleAccount()).resolves.toBeUndefined();
    expect(mockGoogleSignOut).toHaveBeenCalledTimes(2);
  });

  it('"Continue with Google" always clears the remembered account first, so the chooser shows', async () => {
    await expect(signInWithGoogle()).resolves.toBe('ok');
    expect(mockOrder).toEqual(['forget Google account', 'Google chooser']);
  });
});
