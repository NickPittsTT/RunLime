import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import InboxScreen from '../app/(app)/inbox';
import NotificationSettingsScreen from '../app/(app)/notification-settings';
import NotificationsExplainer from '../app/(app)/notifications-explainer';
import { TopBar } from '../src/components/TopBar';
import { queryMock as mockQueryMock } from '../test-utils/races';

const mockPush = jest.fn();
const mockRpc = jest.fn();
const mockUpsert = jest.fn();
let mockRows: unknown[] = [];
let mockSettings: unknown = null;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(cb, [cb]);
  },
  Stack: { Screen: () => null },
}));
const mockPushStatus = jest.fn(async () => 'off');
const mockEnable = jest.fn();
const mockOffered = jest.fn();
jest.mock('@/lib/push', () => ({ pushStatus: () => mockPushStatus(), syncPushRegistration: () => mockPushStatus(), openSystemSettings: jest.fn(), enablePush: (u: string) => mockEnable(u), markPushOffered: (u: string) => mockOffered(u) }));
jest.mock('@/state/session', () => ({ useSession: () => ({ profile: { id: 'u1' } }) }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: (t: string) =>
      t === 'notification_settings'
        ? Object.assign(mockQueryMock({ data: mockSettings, error: null }), { upsert: (...a: unknown[]) => (mockUpsert(...a), Promise.resolve({ error: null })) })
        : mockQueryMock({ data: mockRows, error: null }),
  },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const n = (id: string, kind: string, title: string, data: Record<string, string>, read = false) => ({
  id, kind, title, body: '', data, created_at: new Date(Date.now() - 5 * 60000).toISOString(), read_at: read ? new Date().toISOString() : null,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('notification inbox (M21)', () => {
  it('lists notifications (unread first-class), opens the race and marks it read', async () => {
    mockRows = [n('n1', 'race_postponed', 'Savannah 5K is postponed to Sat 15 Nov 2031, 6:30 am', { event_id: 'r1' }), n('n2', 'follow_accepted', 'Kim approved your follow request', { person_id: 'p1' }, true)];
    render(<InboxScreen />);
    expect(await screen.findByText('1 unread')).toBeTruthy();
    expect(screen.getAllByTestId('unread-dot')).toHaveLength(1);
    fireEvent.press(screen.getByRole('button', { name: /^Unread\. Savannah 5K is postponed to Sat 15 Nov 2031, 6:30 am/ }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: '/race/[id]', params: { id: 'r1' } }));
    expect(mockRpc).toHaveBeenCalledWith('mark_notifications_read', { p_ids: ['n1'] });
    expect(screen.getByText('All caught up')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /^Kim approved/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/person/[id]', params: { id: 'p1' } });
  });

  it('mark all as read; a follow request opens Followers', async () => {
    mockRows = [n('a', 'follow_request', 'Sam asked to follow you', { person_id: 'p2' }), n('b', 'club_approved', "You're now a member of Milers", { club_id: 'c1' })];
    render(<InboxScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Mark all as read' }));
    expect(mockRpc).toHaveBeenCalledWith('mark_notifications_read', { p_ids: null });
    fireEvent.press(screen.getByRole('button', { name: /Sam asked to follow you/ }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: '/people' }));
  });

  it('empty state', async () => {
    mockRows = [];
    render(<InboxScreen />);
    expect(await screen.findByText(/No notifications yet/)).toBeTruthy();
  });

  it('the bell shows the unread count', () => {
    render(<TopBar title="Races" unread={3} onMenu={jest.fn()} onBell={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeTruthy();
    expect(screen.getByTestId('bell-badge')).toBeTruthy();
  });
});

describe('notification settings', () => {
  it('phone notifications off: offers the explainer (never the system prompt directly)', async () => {
    mockSettings = null;
    render(<NotificationSettingsScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Turn on phone notifications' }));
    expect(mockPush).toHaveBeenCalledWith('/notifications-explainer');
  });

  it('allowed but this phone not connected: says so and offers Try again (not "On")', async () => {
    mockSettings = null;
    mockPushStatus.mockResolvedValueOnce('unavailable').mockResolvedValueOnce('on');
    render(<NotificationSettingsScreen />);
    expect(await screen.findByText(/couldn.t be connected for phone notifications/)).toBeTruthy();
    expect(screen.queryByText('Phone notifications: On')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Phone notifications: On')).toBeTruthy();
  });

  it('all on by default; turning one off saves to the account', async () => {
    mockSettings = null;
    render(<NotificationSettingsScreen />);
    const sw = await screen.findByRole('switch', { name: 'Updates from race organisers' });
    expect(sw.props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(sw);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', organiser_messages: false, race_changes: true }), { onConflict: 'user_id' });
  });
});

describe('notifications explainer (M10, Android 13+ permission)', () => {
  it('explains first; the system prompt comes only from "Turn on notifications"', async () => {
    mockEnable.mockResolvedValue('on');
    render(<NotificationsExplainer />);
    expect(screen.getByText('Get race updates on your phone?')).toBeTruthy();
    expect(mockEnable).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));
    expect(await screen.findByText('Notifications are on.')).toBeTruthy();
    expect(mockEnable).toHaveBeenCalledWith('u1');
  });
  it('denied: points to phone settings; build without Firebase: inbox still works', async () => {
    mockEnable.mockResolvedValueOnce('denied');
    render(<NotificationsExplainer />);
    fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));
    expect(await screen.findByRole('button', { name: 'Open phone settings' })).toBeTruthy();
  });
  it('"Not now" remembers the choice and does not prompt', () => {
    render(<NotificationsExplainer />);
    fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(mockOffered).toHaveBeenCalledWith('u1');
    expect(mockEnable).not.toHaveBeenCalled();
  });
});
