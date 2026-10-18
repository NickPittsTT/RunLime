import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import MyRacesScreen from '../app/(app)/my-races';
import { RsvpPanel } from '../src/components/RsvpPanel';
import { RaceCard } from '../src/components/RaceCard';
import { queryMock, race } from '../test-utils/races';

const mockPush = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(cb, [cb]);
  },
  Stack: { Screen: () => null },
}));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (t: string) => mockFrom(t) } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const future = race('r1', 5, { name: 'Savannah 5K' });
const settings = [{ key: 'rsvp.max_adults', value: '4' }, { key: 'rsvp.max_children', value: '3' }];
function backend({ mine = null as unknown, counts = [{ event_id: 'r1', going: 0, maybe: 0 }], myRaces = [] as unknown[] } = {}) {
  mockFrom.mockImplementation((t: string) => (t === 'rsvps' ? queryMock({ data: mine, error: null }) : queryMock({ data: settings, error: null })));
  mockRpc.mockImplementation(async (fn: string) => (fn === 'rsvp_counts' ? { data: counts, error: null } : { data: null, error: null }));
  if (myRaces.length) {
    mockFrom.mockImplementation((t: string) => (t === 'rsvps' ? queryMock({ data: myRaces, error: null }) : queryMock({ data: settings, error: null })));
  }
}

beforeAll(async () => {
  backend();
  render(<RsvpPanel eventId="r1" eventStatus="published" startsAt={future.starts_at} />);
  await screen.findByText('Are you going?', {}, { timeout: 60_000 });
  cleanup();
}, 60_000);
beforeEach(() => jest.clearAllMocks());

describe('RSVP (M18/M19)', () => {
  it('Going with a group: adults include you, children are a number only; saved through set_rsvp', async () => {
    backend({ counts: [{ event_id: 'r1', going: 7, maybe: 2 }] });
    render(<RsvpPanel eventId="r1" eventStatus="published" startsAt={future.starts_at} />);
    expect(await screen.findByText('7 going · 2 maybe')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Going' }));
    expect(screen.getByText('Children under 18 must be with an adult. We only keep the number, never names or ages.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fewer adults' }).props.accessibilityState).toMatchObject({ disabled: true }); // you count
    fireEvent.press(screen.getByRole('button', { name: 'More adults' }));
    for (let i = 0; i < 5; i++) fireEvent.press(screen.getByRole('button', { name: 'More children' }));
    expect(screen.getByLabelText('Children under 18: 3 children')).toBeTruthy(); // capped by the setting (3)
    expect(screen.getByRole('button', { name: 'More children' }).props.accessibilityState).toMatchObject({ disabled: true });
    mockRpc.mockImplementation(async (fn: string) => (fn === 'rsvp_counts' ? { data: [{ event_id: 'r1', going: 9, maybe: 2 }], error: null } : { data: null, error: null }));
    fireEvent.press(screen.getByRole('button', { name: 'Save RSVP' }));
    expect(await screen.findByText("You're going. It's in My races.")).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('set_rsvp', { p_event: 'r1', p_status: 'going', p_adults: 2, p_children: 3 });
    expect(screen.getByText('9 going · 2 maybe')).toBeTruthy();
  });

  it('shows your saved RSVP, and Not going hides the group counts', async () => {
    backend({ mine: { status: 'maybe', adults: 1, children: 2 } });
    render(<RsvpPanel eventId="r1" eventStatus="published" startsAt={future.starts_at} />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Maybe' }).props.accessibilityState).toMatchObject({ checked: true }));
    expect(screen.getByLabelText('Children under 18: 2 children')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update RSVP' }).props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByRole('radio', { name: 'Not going' }));
    expect(screen.queryByText('Children under 18')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Update RSVP' }));
    expect(await screen.findByText('Saved as Not going.')).toBeTruthy();
  });

  it('cancelled races close RSVPs', async () => {
    backend();
    render(<RsvpPanel eventId="r1" eventStatus="cancelled" startsAt={future.starts_at} />);
    expect(await screen.findByText('This race is cancelled, so RSVPs are closed.')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Going' })).toBeNull();
  });
  it('server errors are shown', async () => {
    backend();
    mockRpc.mockImplementation(async (fn: string) =>
      fn === 'rsvp_counts' ? { data: [], error: null } : { data: null, error: { code: '22023', message: 'This race has already taken place' } },
    );
    render(<RsvpPanel eventId="r1" eventStatus="published" startsAt={future.starts_at} />);
    fireEvent.press(await screen.findByRole('radio', { name: 'Going' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save RSVP' }));
    expect(await screen.findByText('This race has already taken place')).toBeTruthy();
  });

  it('race cards show "N going"', () => {
    render(<RaceCard event={future} going="12 going" onPress={jest.fn()} />);
    expect(screen.getByText('· 12 going')).toBeTruthy();
  });
});

describe('My races (M20)', () => {
  it('lists Going/Maybe races: coming up (soonest first) then past, with your group', async () => {
    backend({
      myRaces: [
        { status: 'maybe', adults: 1, children: 0, events: race('later', 20, { name: 'Later 10K' }) },
        { status: 'going', adults: 2, children: 1, events: race('soon', 3, { name: 'Soon 5K' }) },
        { status: 'going', adults: 1, children: 0, events: race('old', -30, { name: 'Old Fun Run' }) },
      ],
    });
    render(<MyRacesScreen />);
    expect(await screen.findByText('Coming up')).toBeTruthy();
    const names = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string).filter((l) => /5K|10K|Fun Run/.test(l ?? ''));
    expect(names.map((n) => n.split(',')[0])).toEqual(['Soon 5K', 'Later 10K', 'Old Fun Run']);
    expect(screen.getByText('Going · 2 adults, 1 child')).toBeTruthy();
    expect(screen.getByText('Maybe')).toBeTruthy();
    expect(screen.getByText('Past races')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /^Soon 5K/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/race/[id]', params: { id: 'soon' } });
  });
  it('empty state points back to the calendar', async () => {
    backend();
    mockFrom.mockImplementation(() => queryMock({ data: [], error: null }));
    render(<MyRacesScreen />);
    expect(await screen.findByText("You haven't said you're going to any races yet.")).toBeTruthy();
  });
});
