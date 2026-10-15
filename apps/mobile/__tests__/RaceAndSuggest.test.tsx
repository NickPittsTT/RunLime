import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
jest.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => mockFrom(t), rpc: (...a: unknown[]) => mockRpc(...a) } }));
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

function backend(row: unknown) {
  mockFrom.mockImplementation((table: string) =>
    table === 'events'
      ? queryMock({ data: row, error: null })
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
    expect(await screen.findByText('Postponed.')).toBeTruthy();
    expect(screen.getByText('Heavy rain')).toBeTruthy();
    await screen.findByText(/Under-18s must be with an adult\./);
    expect(screen.queryByText(NOTICE)).toBeNull();
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
  });

  it('skip saves no preferences', async () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(JSON.parse((await AsyncStorage.getItem('runlime.preferences.v1'))!)).toEqual({ onboarded: true, regionIds: [], distanceKm: [] });
  });
});
