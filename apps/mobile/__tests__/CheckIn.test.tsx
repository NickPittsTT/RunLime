import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CheckInPanel } from '@/components/CheckInPanel';
import { windowState } from '@/lib/checkin';

const mockRpc = jest.fn();
const mockPerm = jest.fn();
const mockPos = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: () => mockPerm(),
  getCurrentPositionAsync: () => mockPos(),
}));

const iso = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const status = (over: object = {}) => ({ checked_in: false, checked_in_at: null, check_in_status: null, opens_at: iso(-30), closes_at: iso(200), radius_m: 500, live: true, help_request: null, ...over });

beforeEach(() => {
  mockRpc.mockReset();
  mockPerm.mockResolvedValue({ status: 'granted' });
  mockPos.mockResolvedValue({ coords: { latitude: 10.672, longitude: -61.51, accuracy: 8 } });
});

describe('GPS check-in (Phase 4)', () => {
  it('window states follow the server times', () => {
    expect(windowState({ live: true, opens_at: iso(10), closes_at: iso(100) })).toBe('before');
    expect(windowState({ live: true, opens_at: iso(-10), closes_at: iso(100) })).toBe('open');
    expect(windowState({ live: true, opens_at: iso(-300), closes_at: iso(-10) })).toBe('after');
    expect(windowState({ live: false, opens_at: iso(-10), closes_at: iso(100) })).toBe('not_live');
  });

  it('before the window: says when it opens; no button', async () => {
    mockRpc.mockResolvedValueOnce({ data: status({ opens_at: iso(45), closes_at: iso(300) }), error: null });
    render(<CheckInPanel eventId="e1" timezone="America/Port_of_Spain" />);
    expect(await screen.findByText(/Check-in opens at .* \(1 hour before the start\) and works within 500 m/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
  });

  it('in the window: reads one position (while-in-use permission) and checks in', async () => {
    mockRpc.mockResolvedValueOnce({ data: status(), error: null }).mockResolvedValueOnce({ data: { result: 'ok', distance_m: 222, radius_m: 500 }, error: null }).mockResolvedValueOnce({ data: status({ checked_in: true, checked_in_at: iso(0), check_in_status: 'gps' }), error: null });
    render(<CheckInPanel eventId="e1" timezone="America/Port_of_Spain" />);
    fireEvent.press(await screen.findByRole('button', { name: 'Check in' }));
    expect(await screen.findByText("You're checked in. It counts as a race attended.")).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('check_in', { p_event: 'e1', p_lat: 10.672, p_lng: -61.51, p_accuracy_m: 8 });
    expect(await screen.findByText(/Checked in at .*, by GPS\./)).toBeTruthy();
  });

  it('too far: says how far, then offers "I\'m here but can\'t check in"', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: status(), error: null })
      .mockResolvedValueOnce({ data: { result: 'too_far', distance_m: 1720, radius_m: 500 }, error: null })
      .mockResolvedValueOnce({ data: status(), error: null })
      .mockResolvedValueOnce({ data: 'req-1', error: null })
      .mockResolvedValueOnce({ data: status({ help_request: 'pending' }), error: null });
    render(<CheckInPanel eventId="e1" timezone="America/Port_of_Spain" />);
    fireEvent.press(await screen.findByRole('button', { name: 'Check in' }));
    expect(await screen.findByText(/about 1720 m from the start; check-in works within 500 m/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Anything that helps us confirm you're there (optional)"), 'At the tent');
    fireEvent.press(screen.getByRole('button', { name: "I'm here but can't check in" }));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('request_checkin_help', { p_event: 'e1', p_note: 'At the tent' }));
    expect(await screen.findByText(/Sent\. A RunLime admin will check/)).toBeTruthy();
  });

  it('location refused: explains, sends nothing', async () => {
    mockPerm.mockResolvedValue({ status: 'denied' });
    mockRpc.mockResolvedValueOnce({ data: status(), error: null });
    render(<CheckInPanel eventId="e1" timezone="America/Port_of_Spain" />);
    fireEvent.press(await screen.findByRole('button', { name: 'Check in' }));
    expect(await screen.findByText(/Check-in needs your location while the app is open/)).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('not live (cancelled, or postponed with no new date): nothing shown', async () => {
    mockRpc.mockResolvedValueOnce({ data: status({ live: false }), error: null });
    render(<CheckInPanel eventId="e1" timezone="America/Port_of_Spain" />);
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(screen.queryByTestId('checkin-panel')).toBeNull();
  });
});
