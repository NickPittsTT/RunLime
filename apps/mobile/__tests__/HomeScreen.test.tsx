import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { formatEventDateTime } from '@runlime/shared/events';
import { Alert, StyleSheet } from 'react-native';
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

/** Pull to refresh on the race list (calls the ScrollView's RefreshControl). */
async function pullToRefresh(testID = 'races-scroll') {
  const control = screen.getByTestId(testID).props.refreshControl as { props: { onRefresh: () => void } };
  await act(async () => {
    control.props.onRefresh();
  });
}

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
    // No bottom tab bar: the only tab list is the List | Map switch.
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['List', 'Map']);
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
    for (const label of ['Leaderboards', 'Run history', 'Clubs']) {
      expect(screen.getByRole('button', { name: `${label}, coming soon` })).toBeTruthy();
    }
    fireEvent.press(screen.getByRole('button', { name: 'My races' }));
    expect(mockPush).toHaveBeenCalledWith('/my-races');
    fireEvent.press(screen.getByRole('button', { name: 'Open menu' }));
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

  it('item 7: after uninstall/reinstall (nothing on the phone) the welcome answers come back from the account', async () => {
    await AsyncStorage.clear(); // a fresh install has no device copy
    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return queryMock({ data: EVENTS, error: null });
      if (table === 'user_preferences')
        return queryMock({ data: { region_ids: ['pos'], distance_km: [5], onboarded_at: '2026-10-15T12:00:00Z' }, error: null });
      if (table === 'regions') return queryMock({ data: [{ id: 'pos', name: 'Port of Spain' }], error: null });
      return queryMock({ data: [], error: null });
    });
    render(<HomeScreen />);
    // The saved areas and distances are the calendar filters again, and the welcome screens are skipped.
    expect(await screen.findByText(/Showing: Port of Spain, 5K/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalledWith('/onboarding');
  });

  it('offline: shows the saved calendar with a banner', async () => {
    await AsyncStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), events: [race('c', 3, { name: 'Saved Race' })] }));
    backend(null, true);
    render(<HomeScreen />);
    expect(await screen.findByText('Saved Race')).toBeTruthy();
    expect(screen.getByText(/^Offline\. Showing races as last updated/)).toBeTruthy();
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

describe('home: status changes, list/map switch, filters summary', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await onboarded();
  });

  it('a race postponed on the server shows a status banner in the list and calendar after pull-to-refresh', async () => {
    const live = race('p', 4, { name: 'PSCU Anniversary 5K' });
    backend([live]);
    render(<HomeScreen />);
    expect(await screen.findByText('PSCU Anniversary 5K')).toBeTruthy();
    expect(screen.queryByTestId('status-banner-postponed')).toBeNull();

    // The organiser postpones it on the website.
    backend([{ ...live, status: 'postponed', status_reason: 'Heavy rain forecast' }]);
    await pullToRefresh();

    expect(await screen.findByTestId('status-banner-postponed')).toBeTruthy();
    expect(screen.getByText('POSTPONED')).toBeTruthy();
    expect(screen.getByText('Heavy rain forecast')).toBeTruthy();
    expect(screen.getByLabelText(/1 race, 1 postponed/)).toBeTruthy();
    expect(screen.getByText(/^Updated /)).toBeTruthy();

    // ...and then cancels it.
    backend([{ ...live, status: 'cancelled', status_reason: 'Venue unavailable' }]);
    await pullToRefresh();
    expect(await screen.findByTestId('status-banner-cancelled')).toBeTruthy();
    expect(screen.getByLabelText(/1 race, 1 cancelled/)).toBeTruthy();
  });

  it('a race postponed to a new date on the server: the app shows "Postponed to", the new date and the struck-through original', async () => {
    const live = race('p', 3, { name: 'PSCU Anniversary 5K' });
    const moved = race('p', 10, { name: 'PSCU Anniversary 5K' });
    const originalKey = live.starts_at.slice(0, 10);
    const newKey = moved.starts_at.slice(0, 10);
    backend([live]);
    render(<HomeScreen />);
    expect(await screen.findByText('PSCU Anniversary 5K')).toBeTruthy();

    // An admin postpones it on the website to a new date (server keeps the original in original_starts_at).
    backend([{ ...live, status: 'postponed', status_reason: 'Heavy rain forecast', starts_at: moved.starts_at, original_starts_at: live.starts_at }]);
    await pullToRefresh();

    const newDate = formatEventDateTime(moved.starts_at, moved.timezone);
    const originalDate = formatEventDateTime(live.starts_at, live.timezone);
    expect(await screen.findByTestId('postponed-to')).toBeTruthy();
    expect(screen.getByText(`Postponed to ${newDate}`)).toBeTruthy();
    const original = screen.getByTestId('original-date');
    expect(original.props.children).toBe(originalDate);
    expect(StyleSheet.flatten(original.props.style)).toMatchObject({ textDecorationLine: 'line-through' });
    // Calendar: the new date is marked postponed (yellow); the original date is marked as moved (struck through).
    expect(screen.getByTestId(`day-${newKey}-postponed`)).toBeTruthy();
    expect(screen.getByTestId(`day-${originalKey}-moved`)).toBeTruthy();
    // Tapping the original date still finds the race, with its new date.
    fireEvent.press(screen.getByLabelText(/original date of 1 postponed race/));
    expect(await screen.findByText(`Postponed to ${newDate}`)).toBeTruthy();
  });

  it('offline: the saved copy keeps the last known status, labelled with when it was updated', async () => {
    await AsyncStorage.setItem(
      CALENDAR_CACHE_KEY,
      JSON.stringify({ savedAt: '2026-10-17T21:42:00Z', events: [race('c', 3, { name: 'Saved Race', status: 'postponed', status_reason: 'Rain' })] }),
    );
    backend(null, true);
    render(<HomeScreen />);
    expect(await screen.findByTestId('status-banner-postponed')).toBeTruthy();
    expect(screen.getByText(/Offline\. Showing races as last updated 17 Oct, 5:42/)).toBeTruthy();
  });

  it('opens on List; List | Map switch; map pins carry the race name', async () => {
    backend(EVENTS);
    render(<HomeScreen />);
    await screen.findByText('Savannah 5K');
    expect(screen.getByRole('tab', { name: 'List' }).props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByRole('tab', { name: 'Map' }));
    expect(screen.getByRole('tab', { name: 'Map' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getAllByText('Savannah 5K').length).toBeGreaterThan(0); // pin label
    expect(screen.getByTestId('map-attribution')).toBeTruthy();
  });

  it('active filters show as a summary line with one-tap clear', async () => {
    await AsyncStorage.setItem('runlime.preferences.v1', JSON.stringify({ onboarded: true, regionIds: ['pos'], distanceKm: [5, 0] }));
    backend(EVENTS);
    render(<HomeScreen />);
    expect(await screen.findByText(/Showing: Port of Spain, Fun walk \/ under 5K, 5K/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.queryByTestId('filter-summary')).toBeNull();
  });

  it('Filters: Select all / Clear all for areas and distances', async () => {
    backend(EVENTS);
    render(<HomeScreen />);
    await screen.findByText('Savannah 5K');
    fireEvent.press(screen.getByRole('checkbox', { name: 'Filters' }));
    const [areasAll, distancesAll] = screen.getAllByRole('button', { name: 'Select all' });
    fireEvent.press(areasAll!);
    fireEvent.press(distancesAll!);
    expect(screen.getByRole('checkbox', { name: 'Port of Spain' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole('checkbox', { name: 'Fun walk / under 5K' }).props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(screen.getAllByRole('button', { name: 'Clear all' })[1]!);
    expect(screen.getByRole('checkbox', { name: 'Marathon' }).props.accessibilityState).toMatchObject({ checked: false });
  });
});
