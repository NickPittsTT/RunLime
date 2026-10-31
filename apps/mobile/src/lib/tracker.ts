import { SAMPLING, estimateCalories, encodePolyline, summarise, type RunSummary } from '@runlime/shared/runs';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { activePoints, appendPoints, clearActive, getState, saveRun, setState, type LocalRun } from './runDb';

/**
 * Run tracking (Phase 5, Phase 0 design): expo-location updates delivered to a TaskManager task through an Android
 * foreground service (visible notification), so recording continues with the screen locked. It needs only the
 * "while using the app" location permission because the runner starts it from the open app (no background
 * permission; ACCESS_BACKGROUND_LOCATION stays blocked). Fixes go straight into SQLite, so a run survives the app
 * being closed and is uploaded later.
 */
export const RUN_TASK = 'runlime-run-tracker';

interface ActiveRun {
  id: string;
  startedAt: number;
  pauses: [number, number][];
  pausedSince: number | null;
  autoPause: boolean;
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(RUN_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  appendPoints(data.locations.map((l) => ({ t: l.timestamp, lat: l.coords.latitude, lng: l.coords.longitude, acc: l.coords.accuracy ?? null })));
});

export function activeRun(): ActiveRun | null {
  return getState<ActiveRun>('active');
}

export type StartResult = { ok: true } | { ok: false; reason: 'denied' | 'services_off' | 'failed' };

export async function startRun(autoPause: boolean): Promise<StartResult> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return { ok: false, reason: 'denied' };
  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'services_off' };
  clearActive();
  setState('active', { id: Crypto.randomUUID(), startedAt: Date.now(), pauses: [], pausedSince: null, autoPause } satisfies ActiveRun);
  try {
    await Location.startLocationUpdatesAsync(RUN_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: SAMPLING.timeIntervalMs,
      distanceInterval: SAMPLING.distanceIntervalM,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'RunLime is recording your run',
        notificationBody: 'Tap to see your run. Stop the run in the app to end recording.',
        notificationColor: '#3F7D0F',
        killServiceOnDestroy: false,
      },
    });
    return { ok: true };
  } catch {
    clearActive();
    return { ok: false, reason: 'failed' };
  }
}

export function pauseRun() {
  const a = activeRun();
  if (a && !a.pausedSince) setState('active', { ...a, pausedSince: Date.now() });
}
export function resumeRun() {
  const a = activeRun();
  if (a?.pausedSince) setState('active', { ...a, pauses: [...a.pauses, [a.pausedSince, Date.now()]], pausedSince: null });
}
export function setAutoPause(on: boolean) {
  const a = activeRun();
  if (a) setState('active', { ...a, autoPause: on });
}

/** Live numbers for the run in progress, from the points recorded so far. */
export function liveSummary(now = Date.now()): (RunSummary & { paused: boolean }) | null {
  const a = activeRun();
  if (!a) return null;
  const pauses: [number, number][] = a.pausedSince ? [...a.pauses, [a.pausedSince, now]] : a.pauses;
  return { ...summarise(activePoints(), { startedAt: a.startedAt, now, pauses, autoPause: a.autoPause }), paused: a.pausedSince !== null };
}

/** Stops recording and returns the finished run (not saved yet: the runner chooses Save or Discard). */
export async function stopRun(opts: { steps: number | null; weightKg: number | null }): Promise<Omit<LocalRun, 'synced'> | null> {
  if (await TaskManager.isTaskRegisteredAsync(RUN_TASK)) await Location.stopLocationUpdatesAsync(RUN_TASK);
  const a = activeRun();
  if (!a) return null;
  const now = Date.now();
  const pauses: [number, number][] = a.pausedSince ? [...a.pauses, [a.pausedSince, now]] : a.pauses;
  const s = summarise(activePoints(), { startedAt: a.startedAt, now, pauses, autoPause: a.autoPause });
  const cal = estimateCalories(s.distanceM, s.movingS, opts.weightKg);
  return {
    id: a.id,
    started_at: new Date(a.startedAt).toISOString(),
    ended_at: new Date(now).toISOString(),
    distance_m: s.distanceM,
    moving_seconds: s.movingS,
    elapsed_seconds: s.elapsedS,
    avg_pace_sec_per_km: s.avgPaceSPerKm,
    splits: s.splits,
    steps: opts.steps,
    calories_est: cal.kcal,
    calories_basis: cal.basis,
    route_polyline: encodePolyline(s.route),
    point_count: s.route.length,
    event_id: null,
  };
}

export function keepFinishedRun(run: Omit<LocalRun, 'synced'>) {
  saveRun(run);
  clearActive();
}
export function discardActiveRun() {
  clearActive();
}
