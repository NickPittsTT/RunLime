import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AgeGateScreen from '../app/(auth)/index';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSetPassedDob = jest.fn();
const mockSupabase = { auth: { signInWithOtp: jest.fn() }, rpc: jest.fn(), from: jest.fn() };

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
jest.mock('@/state/session', () => ({ useSession: () => ({ setPassedDob: mockSetPassedDob }) }));
jest.mock('@/lib/supabase', () => ({ supabase: mockSupabase }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});

async function enterDob(day: string, month: string, year: string) {
  fireEvent.changeText(await screen.findByLabelText('Day'), day);
  fireEvent.changeText(screen.getByLabelText('Month'), month);
  fireEvent.changeText(screen.getByLabelText('Year'), year);
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
}

describe('age gate screen (first screen, before any sign-in method)', () => {
  // React Native requires its built-in components lazily, so the FIRST render in a fresh Jest process also
  // compiles ScrollView/TextInput/Pressable etc. (~6 s on a cold cache, as on CI). Pay that one-off cost here,
  // outside the tests, so every test below keeps Jest's default 5 s limit and the default findBy timeouts.
  beforeAll(async () => {
    render(<AgeGateScreen />);
    await screen.findByText('What is your date of birth?', {}, { timeout: 60_000 });
    cleanup();
  }, 60_000);

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('shows the date of birth question and no sign-in options', async () => {
    render(<AgeGateScreen />);
    expect(await screen.findByText('What is your date of birth?')).toBeTruthy();
    expect(screen.queryByText(/Google|Apple|Email/)).toBeNull();
  });

  it('sends an adult on to sign-in, keeping the DOB in memory only', async () => {
    render(<AgeGateScreen />);
    await enterDob('15', '6', '1990');
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/sign-in'));
    expect(mockSetPassedDob).toHaveBeenCalledWith('1990-06-15');
  });

  it('blocks an under-18 without any network call', async () => {
    render(<AgeGateScreen />);
    await enterDob('1', '1', String(new Date().getFullYear() - 14));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/blocked'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('keeps showing the block on the next visit (device flag only)', async () => {
    await AsyncStorage.setItem('runlime.ageBlockedAt', String(Date.now()));
    render(<AgeGateScreen />);
    expect(await screen.findByText(/can.t create a RunLime account/)).toBeTruthy();
    expect(screen.queryByLabelText('Day')).toBeNull();
  });

  it('asks for a complete date', async () => {
    render(<AgeGateScreen />);
    fireEvent.changeText(await screen.findByLabelText('Day'), '1');
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Please enter your full date of birth.')).toBeTruthy();
  });
});
