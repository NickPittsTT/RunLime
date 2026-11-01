import { render, screen } from '@testing-library/react-native';

// Saving a run goes straight to this screen (1 Nov fix): it shows the phone's copy at once and says whether the
// upload has happened, then refreshes after the upload.
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'r1', saved: '1' }),
  Stack: { Screen: () => null },
}));
jest.mock('@/components/RaceMap', () => ({ RaceMap: () => null }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '/tmp' } }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
const run = { id: 'r1', started_at: '2026-11-01T10:00:00Z', ended_at: '2026-11-01T10:05:00Z', distance_m: 1000, moving_seconds: 235, elapsed_seconds: 258, avg_pace_sec_per_km: 235, splits: [235], steps: null, calories_est: 58, calories_basis: 'general', route_polyline: '', point_count: 99, event_id: null };
let mockSynced = false;
jest.mock('@/lib/runDb', () => ({ localRuns: () => [{ ...run, synced: mockSynced }] }));
let mockFinishSync: () => void = () => undefined;
jest.mock('@/lib/runSync', () => ({
  syncRuns: () =>
    new Promise<void>((resolve) => {
      mockFinishSync = () => {
        mockSynced = true;
        resolve();
      };
    }),
  loadRuns: async () => ({ runs: [{ ...run, synced: mockSynced, raceName: 'UI 5K' }], offline: false }),
  deleteRun: jest.fn(),
}));

// eslint-disable-next-line import/first
import RunDetail from '../app/(app)/runs/[id]';

describe('run detail after saving', () => {
  it('shows the run at once as saved on the phone, then "Saved." when the upload is done', async () => {
    render(<RunDetail />);
    expect(screen.getByText('1.00 km')).toBeTruthy();
    expect(screen.getByText(/Saved on this phone/)).toBeTruthy();
    mockFinishSync();
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(screen.getByText('Race: UI 5K')).toBeTruthy();
  });
});
