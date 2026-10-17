import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import OnboardingScreen from '../app/(app)/onboarding';
import RaceScreen from '../app/(app)/race/[id]';
import SuggestRaceScreen from '../app/(app)/suggest-race';
import { queryMock, race } from '../test-utils/races';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({ id: 'a' }),
  Stack: { Screen: () => null },
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
const mockUpsert = jest.fn(async () => ({ data: null, error: null }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (t: string) => mockFrom(t),
    rpc: (...a: unknown[]) => mockRpc(...a),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
  },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const NOTICE = 'RunLime is not affiliated with this race. Check details with the organiser.';
const detail = (over: Record<string, unknown> = {}) => ({
  ...race('a', 4, { name: 'Savannah 5K' }),
  description: 'Flat loop.',
  status_reason: null,
  route: [[-61.51, 10.67], [-61.5, 10.68]],
  registration_url: 'https://example.org/register',
  registration_instructions: null,
  package_collection: 'Friday at the club',
  parking: null,
  contact_email: null,
  contact_phone: null,
  charity_name: null,
  regions: { name: 'Port of Spain' },
  event_media: [],
  event_sponsors: [],
  ...over,
});

function backend(row: unknown, fail = false) {
  mockFrom.mockImplementation((table: string) =>
    table === 'events'
      ? queryMock(fail ? { data: null, error: { message: 'Network request failed' } } : { data: row, error: null })
      : table === 'user_preferences'
        ? Object.assign(queryMock({ data: null, error: null }), { upsert: mockUpsert })
      : table === 'regions'
        ? queryMock({ data: [{ id: 'pos', name: 'Port of Spain' }], error: null })
        : queryMock({
            data: [
              { key: 'events.unaffiliated_notice', value: NOTICE },
              { key: 'legal.minors_notice', value: 'Under-18s must be with an adult.' },
            ],
            error: null,
          }),
  );
}

describe('race details (M16)', () => {
  beforeAll(async () => {
    backend(detail());
    render(<RaceScreen />);
    await screen.findByText('Savannah 5K', {}, { timeout: 60_000 });
    cleanup();
  }, 60_000);
  beforeEach(() => jest.clearAllMocks());

  it('RunLime listing: facts, not-affiliated notice, minors notice, official link', async () => {
    backend(detail());
    render(<RaceScreen />);
    expect(await screen.findByText('Savannah 5K')).toBeTruthy();
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    expect(screen.getByText(/Under-18s must be with an adult\./)).toBeTruthy();
    expect(screen.getByText('Friday at the club')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Register with the organiser' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://example.org/register');
    fireEvent.press(screen.getByRole('button', { name: 'Full-screen route map' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/race/map', params: { id: 'a' } });
  });

  it('organiser event: no not-affiliated notice; postponed banner with reason', async () => {
    backend(detail({ listing_source: 'organiser', status: 'postponed', status_reason: 'Heavy rain' }));
    render(<RaceScreen />);
    expect(await screen.findByTestId('status-banner-postponed')).toBeTruthy();
    expect(screen.getByText('POSTPONED')).toBeTruthy();
    expect(screen.getByText('Heavy rain')).toBeTruthy();
    await screen.findByText(/Under-18s must be with an adult\./);
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('pull to refresh on the race page picks up a cancellation made on the website', async () => {
    backend(detail());
    render(<RaceScreen />);
    expect(await screen.findByText('Savannah 5K')).toBeTruthy();
    expect(screen.queryByTestId('status-banner-cancelled')).toBeNull();
    backend(detail({ status: 'cancelled', status_reason: 'Venue unavailable' }));
    const control = screen.getByTestId('race-scroll').props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => {
      control.props.onRefresh();
    });
    expect(await screen.findByTestId('status-banner-cancelled')).toBeTruthy();
    expect(screen.getByText('Venue unavailable')).toBeTruthy();
    expect(screen.getByText(/^Updated /)).toBeTruthy();
  });

  it('offline: shows the last saved copy of the race with its status and when it was updated', async () => {
    backend(detail({ status: 'postponed', status_reason: 'Rain' }));
    const first = render(<RaceScreen />);
    expect(await screen.findByTestId('status-banner-postponed')).toBeTruthy();
    first.unmount();
    backend(null, true);
    render(<RaceScreen />);
    expect(await screen.findByText(/^Offline\. Showing this race as last updated/)).toBeTruthy();
    expect(screen.getByTestId('status-banner-postponed')).toBeTruthy();
  });

  it('a race that is no longer public', async () => {
    backend(null);
    render(<RaceScreen />);
    expect(await screen.findByText('This race is no longer listed.')).toBeTruthy();
  });
});

describe('suggest a race (M48)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('validates, then calls suggest_race', async () => {
    mockRpc.mockResolvedValue({ data: 'id', error: null });
    render(<SuggestRaceScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Send suggestion' }));
    expect(await screen.findByText('Race name is required')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Race name'), 'Mayaro Beach 5K');
    fireEvent.changeText(screen.getByLabelText('Date (optional)'), '1 March');
    fireEvent.press(screen.getByRole('button', { name: 'Send suggestion' }));
    expect(await screen.findByText('Use YYYY-MM-DD, e.g. 2031-03-01')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Date (optional)'), '2031-03-01');
    fireEvent.press(screen.getByRole('button', { name: 'Send suggestion' }));
    expect(await screen.findByText(/Thanks! We will check the race/)).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('suggest_race', { p_name: 'Mayaro Beach 5K', p_event_date: '2031-03-01', p_location: null, p_url: null, p_notes: null });
  });

  it('shows the rate limit message', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Too many requests, please try again later', code: 'P0429' } });
    render(<SuggestRaceScreen />);
    fireEvent.changeText(screen.getByLabelText('Race name'), 'Mayaro Beach 5K');
    fireEvent.press(screen.getByRole('button', { name: 'Send suggestion' }));
    expect(await screen.findByText('Too many attempts. Please wait a little and try again.')).toBeTruthy();
  });
});

describe('onboarding (M8/M9)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    backend(null);
  });

  it('walkthrough then areas + distances, saved on the device', async () => {
    render(<OnboardingScreen />);
    for (let i = 0; i < 3; i++) fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    fireEvent.press(await screen.findByRole('checkbox', { name: 'Port of Spain' }));
    fireEvent.press(screen.getByRole('checkbox', { name: '5K' }));
    fireEvent.press(screen.getByRole('button', { name: 'Show races' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(JSON.parse((await AsyncStorage.getItem('runlime.preferences.v1'))!)).toEqual({ onboarded: true, regionIds: ['pos'], distanceKm: [5] });
    // Saved to the account, not just the phone.
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', region_ids: ['pos'], distance_km: [5], onboarded_at: expect.any(String) }),
      { onConflict: 'user_id' },
    );
  });

  it('Select all / Clear all for areas and distances; Fun walk / under 5K is offered', async () => {
    render(<OnboardingScreen />);
    for (let i = 0; i < 3; i++) fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('checkbox', { name: 'Port of Spain' });
    const [areasAll, distancesAll] = screen.getAllByRole('button', { name: 'Select all' });
    fireEvent.press(areasAll!);
    fireEvent.press(distancesAll!);
    expect(screen.getByRole('checkbox', { name: 'Fun walk / under 5K' }).props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(screen.getAllByRole('button', { name: 'Clear all' })[0]!);
    expect(screen.getByRole('checkbox', { name: 'Port of Spain' }).props.accessibilityState).toMatchObject({ checked: false });
    fireEvent.press(screen.getByRole('button', { name: 'Show races' }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ region_ids: [], distance_km: [0, 5, 10, 21.1, 42.2] }), { onConflict: 'user_id' }));
  });

  it('skip saves no preferences', async () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(JSON.parse((await AsyncStorage.getItem('runlime.preferences.v1'))!)).toEqual({ onboarded: true, regionIds: [], distanceKm: [] });
  });
});
