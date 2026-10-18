import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ClubScreen from '../app/(app)/club/[id]';
import ClubsScreen from '../app/(app)/clubs';
import RequestClubScreen from '../app/(app)/request-club';
import { RsvpPanel } from '../src/components/RsvpPanel';
import { queryMock as mockQueryMock, race } from '../test-utils/races';

const mockPush = jest.fn();
const mockRpc = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(cb, [cb]);
  },
  Stack: { Screen: () => null },
}));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: () => mockQueryMock({ data: [], error: null }) } }));
jest.mock('@/lib/regions', () => ({ useAreas: () => ({ areas: [] }) }));
jest.mock('@/state/session', () => ({ useSession: () => ({ profile: { id: 'u1' } }) }));
const mockShouldOffer = jest.fn(async () => false);
jest.mock('@/lib/push', () => ({ shouldOfferPush: () => mockShouldOffer() }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const CLUB = 'c1';
const lead = { id: 'u-lead', display_name: 'Lee Leader', nickname: null, avatar_path: null };
const ana = { id: 'u-ana', display_name: 'Ana Applicant', nickname: null, avatar_path: null };
const basePage = { id: CLUB, name: 'Maraval Milers', description: 'Saturday runs', area: 'Port of Spain', members: 3, leaders: [lead], me: null, is_leader: false, requests: null, member_list: null };
function rpcs(h: Record<string, (a: Record<string, unknown>) => unknown>) {
  mockRpc.mockImplementation(async (fn: string, a: Record<string, unknown>) => ({ data: h[fn] ? h[fn]!(a) : null, error: null }));
}
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: CLUB };
});

describe('clubs (M45a)', () => {
  it('directory: your clubs first, others below, request a new club', async () => {
    rpcs({
      club_directory: () => [
        { id: 'c1', name: 'Maraval Milers', description: null, area: 'Port of Spain', members: 3, my_status: 'approved', my_role: 'member', is_primary: true },
        { id: 'c2', name: 'Arima Striders', description: null, area: null, members: 8, my_status: null, my_role: null, is_primary: false },
      ],
    });
    render(<ClubsScreen />);
    expect(await screen.findByText('Your clubs')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Maraval Milers, Member, Primary club, 3 members, Port of Spain' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Arima Striders, 8 members' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: "Can't find your club? Ask us to add it" }));
    expect(mockPush).toHaveBeenCalledWith('/request-club');
  });

  it('joining is a request a leader approves', async () => {
    let page: Record<string, unknown> = { ...basePage };
    rpcs({ club_page: () => page, request_join_club: () => ((page = { ...page, me: { status: 'pending', role: 'member', is_primary: false } }), 'pending') });
    render(<ClubScreen />);
    expect(await screen.findByText('Lee Leader approves join requests.')).toBeTruthy();
    fireEvent.press(await screen.findByRole('button', { name: 'Ask to join' }));
    expect(await screen.findByText('Request sent. A club leader will approve it.')).toBeTruthy();
    expect(screen.getByText('Your request is waiting for Lee Leader to approve it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report this club' })).toBeTruthy();
  });

  it('approved members can make it their primary club and leave (with confirmation)', async () => {
    rpcs({ club_page: () => ({ ...basePage, me: { status: 'approved', role: 'member', is_primary: false } }) });
    const alert = jest.spyOn(Alert, 'alert');
    render(<ClubScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Make this my primary club' }));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('set_primary_club', { p_club: CLUB }));
    fireEvent.press(screen.getByRole('button', { name: 'Leave club' }));
    expect(alert.mock.calls[0]![0]).toBe('Leave Maraval Milers?');
  });

  it('leaders approve requests and see members; members cannot', async () => {
    rpcs({ club_page: () => ({ ...basePage, me: { status: 'approved', role: 'leader', is_primary: false }, is_leader: true, requests: [ana], member_list: [{ ...lead, role: 'leader' }] }) });
    render(<ClubScreen />);
    expect(await screen.findByText('Requests to join (1)')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Ana Applicant is now a member.')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('respond_club_request', { p_club: CLUB, p_user: 'u-ana', p_accept: true });
  });

  it('new-club request form', async () => {
    rpcs({});
    render(<RequestClubScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Enter the club name.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Club name'), 'Point Fortin Pacers');
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText(/We'll review your club request/)).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('request_new_club', { p_name: 'Point Fortin Pacers', p_description: null, p_region: null, p_leader_email: null });
  });

  it('new-club request can name someone else as the leader (by sign-in email)', async () => {
    rpcs({});
    render(<RequestClubScreen />);
    expect(screen.getByText('Who will lead this club?')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Club name'), 'Arima Road Runners');
    fireEvent.press(screen.getByRole('radio', { name: 'Someone else' }));
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Enter the leader’s sign-in email, or choose Me.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Leader's sign-in email"), ' kim@example.com ');
    fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText(/the person you named becomes its first leader/)).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('request_new_club', { p_name: 'Arima Road Runners', p_description: null, p_region: null, p_leader_email: 'kim@example.com' });
  });

  it('race page shows club turnout as counts', async () => {
    rpcs({ rsvp_counts: () => [{ event_id: 'r1', going: 30, maybe: 0 }], club_turnout: () => [{ club_id: CLUB, club_name: 'Maraval Milers', going: 12 }], following_going: () => [] });
    render(<RsvpPanel eventId="r1" eventStatus="published" startsAt={race('r1', 5).starts_at} />);
    expect(await screen.findByText('Maraval Milers: 12 going')).toBeTruthy();
  });
});
