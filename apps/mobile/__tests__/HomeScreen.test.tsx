import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import HomeScreen from '../app/(app)/index';
import { CALENDAR_CACHE_KEY } from '../src/lib/calendar';
import { queryMock, race } from '../test-utils/races';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSignOut = jest.fn();
const mockFrom = jest.fn();

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
jest.mock('@/state/session', () => ({
  useSession: () => ({ profile: { display_name: 'Ana Lopez', nickname: 'Speedy' }, signOut: mockSignOut }),
}));
jest.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => mockFrom(t) } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const EVENTS = [race('a', 2, { name: 'Savannah 5K' }), race('b', 5, { name: 'Chaguaramas Fun Run', venue_name: 'Chaguaramas' })];

function backend(events: unknown, fail = false) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'events') return queryMock(fail ? { data: null, error: { message: 'Network request failed' } } : { data: events, error: null });
    if (table === 'regions') return queryMock({ data: [{ id: 'pos', name: 'Port of Spain' }], error: null });
    return queryMock({ data: [{ key: 'calendar.near_me_radius_km', value: 25 }], error: null });
  });
}

async function onboarded() {
  await AsyncStorage.setItem('runlime.preferences.v1', JSON.stringify({ onboarded: true, regionIds: [], distanceKm: [] }));
}

describe('home: race calendar', () => {
  beforeAll(async () => {
    backend(EVENTS);
    await onboarded();
    render(<HomeScreen />);
    await screen.findByText('Savannah 5K', {}, { timeout: 60_000 });
    cleanup();
  }, 60_000);

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await onboarded();
    backend(EVENTS);
  });

  it('shows the top bar, month view, upcoming races and the Start run button (no tab bar)', async () => {
    render(<HomeScreen />);
    expect(await screen.findByText('Savannah 5K')).toBeTruthy();
    expect(screen.getByText('Chaguaramas Fun Run')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
    expect(screen.getByTestId('month-pager')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start run' })).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('search narrows the list', async () => {
    render(<HomeScreen />);
    await screen.findByText('Savannah 5K');
    fireEvent.changeText(screen.getByLabelText('Search races'), 'chaguaramas');
    expect(screen.queryByText('Savannah 5K')).toBeNull();
    expect(screen.getByText('Chaguaramas Fun Run')).toBeTruthy();
  });

  it('Start run and the bell say coming soon', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render(<HomeScreen />);
    await screen.findByText('Savannah 5K');
    fireEvent.press(screen.getByRole('button', { name: 'Start run' }));
    fireEvent.press(screen.getByRole('button', { name: 'Notifications' }));
    expect(alert.mock.calls.map((c) => c[1])).toEqual(['Coming soon.', 'Coming soon.']);
  });

  it('side menu: profile header, built items open screens, unbuilt items say coming soon', async () => {
    render(<HomeScreen />);
    await screen.findByText('Savannah 5K');
    fireEvent.press(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByText('AL')).toBeTruthy();
    expect(screen.getByText('Speedy')).toBeTruthy();
    for (const label of ['My races', 'Leaderboards', 'Run history', 'Followers', 'Clubs']) {
      expect(screen.getByRole('button', { name: `${label}, coming soon` })).toBeTruthy();
    }
    fireEvent.press(screen.getByRole('button', { name: 'Emergency contact' }));
    expect(mockPush).toHaveBeenCalledWith('/emergency-contact');
    fireEvent.press(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.press(screen.getByRole('button', { name: /Ana Lopez, Speedy/ }));
    expect(mockPush).toHaveBeenCalledWith('/profile');
  });

  it('opens a race', async () => {
    render(<HomeScreen />);
    fireEvent.press(await screen.findByRole('button', { name: /^Savannah 5K/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/race/[id]', params: { id: 'a' } });
  });

  it('sends first-time users to onboarding', async () => {
    await AsyncStorage.clear();
    render(<HomeScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding'));
  });

  it('offline: shows the saved calendar with a banner', async () => {
    await AsyncStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), events: [race('c', 3, { name: 'Saved Race' })] }));
    backend(null, true);
    render(<HomeScreen />);
    expect(await screen.findByText('Saved Race')).toBeTruthy();
    expect(screen.getByText(/^Offline\. Showing races saved/)).toBeTruthy();
  });

  it('offline with nothing saved: error and retry', async () => {
    backend(null, true);
    render(<HomeScreen />);
    expect(await screen.findByText('Could not load races. Check your connection.')).toBeTruthy();
    backend(EVENTS);
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Savannah 5K')).toBeTruthy();
  });
});
