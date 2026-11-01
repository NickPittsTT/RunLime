const mockRpc = jest.fn();
const mockSelect = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: () => ({ select: () => ({ order: () => ({ limit: () => mockSelect() }) }) }) },
}));
let mockLocal: Record<string, unknown>[] = [];
const mockMark = jest.fn();
jest.mock('@/lib/runDb', () => ({
  unsyncedRuns: () => mockLocal.filter((r) => !r.synced),
  localRuns: () => mockLocal,
  markSynced: (id: string) => mockMark(id),
  deleteLocalRun: jest.fn(),
}));

// eslint-disable-next-line import/first
import { LOAD_TIMEOUT_MS, UPLOAD_TIMEOUT_MS, loadRuns, syncRuns } from '@/lib/runSync';

const run = (id: string, synced = false) => ({ id, started_at: `2026-10-3${id}T10:00:00Z`, ended_at: `2026-10-3${id}T10:30:00Z`, distance_m: 5000, moving_seconds: 1500, elapsed_seconds: 1600, avg_pace_sec_per_km: 300, splits: [], steps: null, calories_est: 350, calories_basis: 'general', route_polyline: 'abc', point_count: 3, event_id: null, synced });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('run upload queue (works offline, uploads later)', () => {
  it('uploads waiting runs and marks them synced; never sends a weight', async () => {
    mockLocal = [run('0'), run('1')];
    mockRpc.mockResolvedValue({ data: 'x', error: null });
    expect(await syncRuns()).toEqual({ uploaded: 2, waiting: 0 });
    expect(mockMark.mock.calls.map((c) => c[0])).toEqual(['0', '1']);
    const sent = mockRpc.mock.calls[0]![1].p_run;
    expect(sent.id).toBe('0');
    expect(sent).not.toHaveProperty('weight');
    expect(sent).not.toHaveProperty('synced');
  });
  it('offline: stops at the first failure and keeps the rest for the next try', async () => {
    mockLocal = [run('0'), run('1')];
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Network request failed' } });
    expect(await syncRuns()).toEqual({ uploaded: 0, waiting: 2 });
    expect(mockMark).not.toHaveBeenCalled();
  });
  it('a lost reply never freezes the queue: the upload times out and the run waits for the next try', async () => {
    jest.useFakeTimers();
    mockLocal = [run('0')];
    mockRpc.mockReturnValue(new Promise(() => undefined));
    const p = syncRuns();
    jest.advanceTimersByTime(UPLOAD_TIMEOUT_MS + 1);
    expect(await p).toEqual({ uploaded: 0, waiting: 1 });
    expect(mockMark).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
  it('calls made while an upload is running share it (a run is never sent twice at once)', async () => {
    mockLocal = [run('0')];
    let answer: (v: unknown) => void = () => undefined;
    mockRpc.mockReturnValue(new Promise((r) => (answer = r)));
    const a = syncRuns();
    const b = syncRuns();
    answer({ data: 'x', error: null });
    expect(await a).toEqual({ uploaded: 1, waiting: 0 });
    expect(await b).toEqual({ uploaded: 1, waiting: 0 });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
  it('history falls back to the phone when the server is too slow', async () => {
    jest.useFakeTimers();
    mockLocal = [run('1')];
    mockSelect.mockReturnValue(new Promise(() => undefined));
    const p = loadRuns();
    jest.advanceTimersByTime(LOAD_TIMEOUT_MS + 1);
    const r = await p;
    expect(r.offline).toBe(true);
    expect(r.runs.map((x) => x.id)).toEqual(['1']);
    jest.useRealTimers();
  });
  it('history merges server runs with runs still waiting on this phone (no duplicates); offline shows the phone\'s runs', async () => {
    mockLocal = [run('1'), run('0', true)];
    mockSelect.mockResolvedValue({ data: [{ ...run('0', true), events: { name: 'Savannah 5K' } }], error: null });
    const r = await loadRuns();
    expect(r.runs.map((x) => x.id)).toEqual(['1', '0']);
    expect(r.runs[1]!.raceName).toBe('Savannah 5K');
    mockSelect.mockResolvedValue({ data: null, error: { message: 'offline' } });
    expect((await loadRuns()).offline).toBe(true);
  });
});
