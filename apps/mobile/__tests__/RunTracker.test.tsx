import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

// ---- mocks: tracker (native location + task manager), sensors, sync, prefs, router ----
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockKeep = jest.fn();
let mockLive: unknown = null;
jest.mock('@/lib/tracker', () => ({
  startRun: (...a: unknown[]) => mockStart(...a),
  stopRun: (...a: unknown[]) => mockStop(...a),
  keepFinishedRun: (...a: unknown[]) => mockKeep(...a),
  discardActiveRun: jest.fn(),
  liveSummary: () => mockLive,
  activeRun: () => (mockLive ? { autoPause: true } : null),
  pauseRun: jest.fn(),
  resumeRun: jest.fn(),
  setAutoPause: jest.fn(),
}));
const mockReqSteps = jest.fn();
jest.mock('expo-sensors', () => ({
  Pedometer: {
    requestPermissionsAsync: () => mockReqSteps(),
    getPermissionsAsync: async () => ({ granted: true }),
    isAvailableAsync: async () => true,
    watchStepCount: () => ({ remove: jest.fn() }),
  },
}));
const mockSync = jest.fn();
jest.mock('@/lib/runSync', () => ({ syncRuns: () => mockSync() }));
let mockAsked = false;
jest.mock('@/lib/runPrefs', () => ({
  getAutoPause: async () => true,
  setAutoPausePref: jest.fn(async () => undefined),
  getWeightKg: async () => null,
  setWeightKg: jest.fn(async () => undefined),
  stepsPermissionAsked: async () => mockAsked,
  markStepsPermissionAsked: jest.fn(async () => {
    mockAsked = true;
  }),
}));
let mockAllowed: boolean | null = true;
jest.mock('@/lib/entitlements', () => ({ useEntitlement: () => mockAllowed }));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }) }));
jest.mock('@/components/RaceMap', () => ({ RaceMap: () => null }));

// eslint-disable-next-line import/first
import RunScreen from '../app/(app)/run';

const finished = { id: 'r1', started_at: '2026-10-31T10:00:00Z', ended_at: '2026-10-31T10:30:00Z', distance_m: 5010, moving_seconds: 1500, elapsed_seconds: 1620, avg_pace_sec_per_km: 299, splits: [300], steps: 5200, calories_est: 410, calories_basis: 'general', route_polyline: '', point_count: 0, event_id: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockLive = null;
  mockAsked = false;
  mockAllowed = true;
  mockStart.mockResolvedValue({ ok: true });
});

describe('run tracker (Phase 5)', () => {
  it('first run: asks for the step permission at Start (not at app start), then starts with auto-pause on', async () => {
    render(<RunScreen />);
    expect(mockReqSteps).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(mockStart).toHaveBeenCalledWith(true));
    expect(mockReqSteps).toHaveBeenCalledTimes(1);
  });

  it('the step permission is asked only once; the run starts even if steps are refused', async () => {
    mockAsked = true;
    render(<RunScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    expect(mockReqSteps).not.toHaveBeenCalled();
  });

  it('location refused: explains; nothing records', async () => {
    mockStart.mockResolvedValue({ ok: false, reason: 'denied' });
    render(<RunScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByText(/needs your location while the app is open/)).toBeTruthy();
  });

  it('weight is optional and stays on the phone (never part of the run that is uploaded)', () => {
    render(<RunScreen />);
    expect(screen.getByText('Only for calorie estimates. Stays on this phone; never sent to RunLime.')).toBeTruthy();
    expect(Object.keys(finished)).not.toContain('weight');
  });

  it('live run: time, distance, pace; pause; stop → save uploads and opens the run', async () => {
    mockLive = { distanceM: 1234, movingS: 400, elapsedS: 420, avgPaceSPerKm: 324, splits: [], route: [], autoPaused: false, paused: false };
    mockStop.mockResolvedValue(finished);
    mockSync.mockResolvedValue({ uploaded: 1, waiting: 0 });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Stop')?.onPress?.());
    render(<RunScreen />);
    expect(screen.getByText('1.23 km')).toBeTruthy();
    expect(screen.getByText('5:24 /km')).toBeTruthy();
    expect(screen.getByText('6:40')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    act(() => {
      mockLive = null;
    });
    expect(await screen.findByTestId('run-summary')).toBeTruthy();
    expect(screen.getByText(/About 410 kcal \(general estimate/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Save run' }));
    await waitFor(() => expect(mockKeep).toHaveBeenCalledWith(finished));
    expect(mockSync).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/runs/[id]', params: { id: 'r1', saved: '1' } });
  });

  it('a slow or missing connection never holds the runner on the summary: saved on the phone, straight to the run', async () => {
    mockLive = { distanceM: 10, movingS: 5, elapsedS: 5, avgPaceSPerKm: null, splits: [], route: [], autoPaused: false, paused: false };
    mockStop.mockResolvedValue(finished);
    mockSync.mockReturnValue(new Promise(() => undefined)); // the upload never answers
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Stop')?.onPress?.());
    render(<RunScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    act(() => {
      mockLive = null;
    });
    fireEvent.press(await screen.findByRole('button', { name: 'Save run' }));
    expect(mockKeep).toHaveBeenCalledWith(finished);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/runs/[id]', params: { id: 'r1', saved: '1' } });
  });

  it('entitlement check (feature.tracker, Phase 7): no tracker if the plan does not include it', () => {
    mockAllowed = false;
    render(<RunScreen />);
    expect(screen.getByText('The run tracker is not included in your plan.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
  });
});
