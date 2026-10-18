import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import PeopleScreen from '../app/(app)/people';
import PersonScreen from '../app/(app)/person/[id]';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockRpc = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(cb, [cb]);
  },
  Stack: { Screen: () => null },
}));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const sam = { id: '11111111-1111-4111-8111-111111111111', display_name: 'Sam Runner', nickname: 'Sammy', avatar_path: null as string | null };
const kim = { id: '22222222-2222-4222-8222-222222222222', display_name: 'Kim Pace', nickname: null, avatar_path: null };
const baseCard = { ...sam, runner_level: 'club_runner', account_privacy: 'private', is_me: false, following: null as string | null, follows_you: null as string | null, followers: 4, following_count: 2, can_see_details: false };

function rpcs(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
  mockRpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    const h = handlers[fn];
    return h ? { data: h(args), error: null } : { data: null, error: null };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: sam.id };
});

describe('someone else\'s profile', () => {
  it('private account: "Ask to follow" sends a request; no passport until approved; report and block are there', async () => {
    let card = { ...baseCard };
    rpcs({ profile_card: () => card, follow_user: () => ((card = { ...card, following: 'pending' }), 'pending') });
    render(<PersonScreen />);
    expect(await screen.findByText('Sam Runner')).toBeTruthy();
    expect(screen.getByText('Club runner')).toBeTruthy();
    expect(screen.getByText(/This account is private/)).toBeTruthy();
    expect(screen.queryByText('Race passport')).toBeNull();
    expect(mockRpc).not.toHaveBeenCalledWith('profile_passport', expect.anything());
    fireEvent.press(screen.getByRole('button', { name: 'Ask to follow' }));
    expect(await screen.findByText('Request sent. Sam Runner needs to approve it.')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('follow_user', { p_user: sam.id });
    expect(screen.getByRole('button', { name: 'Requested' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report profile' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Block' })).toBeTruthy();
  });

  it('approved follower sees the race passport and races they are going to', async () => {
    rpcs({
      profile_card: () => ({ ...baseCard, following: 'accepted', can_see_details: true, avatar_path: `${sam.id}/0123456789abcdef0123456789abcdef.jpg` }),
      profile_passport: () => ({ races_attended: 0, total_km: 0, attending: [{ id: 'r1', name: 'Savannah 5K', starts_at: '2031-06-01T10:00:00Z', timezone: 'America/Port_of_Spain', status: 'published', venue_name: 'Savannah' }] }),
    });
    render(<PersonScreen />);
    expect(await screen.findByText('Race passport')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Savannah 5K · Sun,? 1 Jun 2031/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Following' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Report photo' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/report', params: { kind: 'profile_photo', userId: sam.id, name: 'Sam Runner' } });
  });

  it('block asks first, then leaves the profile', async () => {
    rpcs({ profile_card: () => baseCard });
    const alert = jest.spyOn(Alert, 'alert');
    render(<PersonScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Block' }));
    const buttons = alert.mock.calls[0]![2]!;
    expect(alert.mock.calls[0]![0]).toBe('Block Sam Runner?');
    await buttons.find((b) => b.text === 'Block')!.onPress!();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockRpc).toHaveBeenCalledWith('block_user', { p_user: sam.id });
  });

  it('a blocked or missing person cannot be found', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'That person was not found' } });
    render(<PersonScreen />);
    expect(await screen.findByText("This person can't be found.")).toBeTruthy();
  });
});

describe('followers screen (M45)', () => {
  const connections = { followers: [kim], following: [], requests: [sam], sent: [], blocked: [{ id: 'b1', display_name: 'Blocked Bob' }] };

  it('approve a request, remove a follower, unblock', async () => {
    rpcs({ my_connections: () => connections });
    render(<PeopleScreen />);
    expect(await screen.findByRole('tab', { name: 'Requests (1)' })).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'Requests (1)' }));
    fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Sam Runner now follows you.')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('respond_follow_request', { p_follower: sam.id, p_accept: true });
    fireEvent.press(screen.getByRole('tab', { name: 'Followers (1)' }));
    fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Kim Pace no longer follows you.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Unblock' }));
    expect(await screen.findByText('Blocked Bob is unblocked.')).toBeTruthy();
  });

  it('find people by name (after 2 characters) and open a profile', async () => {
    jest.useFakeTimers();
    rpcs({ my_connections: () => connections, search_people: () => [sam] });
    render(<PeopleScreen />);
    fireEvent.changeText(await screen.findByLabelText('Find people'), 'S');
    expect(mockRpc).not.toHaveBeenCalledWith('search_people', expect.anything());
    fireEvent.changeText(screen.getByLabelText('Find people'), 'Sam');
    jest.advanceTimersByTime(400);
    jest.useRealTimers();
    fireEvent.press(await screen.findByRole('button', { name: /^Sam Runner, Sammy/ }));
    expect(mockRpc).toHaveBeenCalledWith('search_people', { p_query: 'Sam' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/person/[id]', params: { id: sam.id } });
  });
});
