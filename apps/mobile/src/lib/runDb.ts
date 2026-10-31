import * as SQLite from 'expo-sqlite';
import type { TrackPoint } from '@runlime/shared/runs';

/**
 * Runs live on the phone first (owner: works offline and uploads later). One SQLite file:
 * - active_points: fixes of the run in progress, written by the background location task
 * - run_state: the run in progress (start time, pauses)
 * - runs: finished runs; `synced = 0` is the upload outbox
 */
export interface LocalRun {
  id: string;
  started_at: string;
  ended_at: string;
  distance_m: number;
  moving_seconds: number;
  elapsed_seconds: number;
  avg_pace_sec_per_km: number | null;
  splits: number[];
  steps: number | null;
  calories_est: number | null;
  calories_basis: 'weight' | 'general' | null;
  route_polyline: string;
  point_count: number;
  event_id: string | null;
  synced: boolean;
}

let db: SQLite.SQLiteDatabase | null = null;
export function runDb(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync('runlime-runs.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS active_points (t INTEGER PRIMARY KEY, lat REAL NOT NULL, lng REAL NOT NULL, acc REAL);
    CREATE TABLE IF NOT EXISTS run_state (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, started_at TEXT NOT NULL, ended_at TEXT NOT NULL, distance_m INTEGER NOT NULL,
      moving_seconds INTEGER NOT NULL, elapsed_seconds INTEGER NOT NULL, avg_pace_sec_per_km INTEGER, splits TEXT NOT NULL,
      steps INTEGER, calories_est INTEGER, calories_basis TEXT, route_polyline TEXT NOT NULL, point_count INTEGER NOT NULL,
      event_id TEXT, synced INTEGER NOT NULL DEFAULT 0);
  `);
  return db;
}

export function appendPoints(points: TrackPoint[]) {
  const d = runDb();
  for (const p of points) d.runSync('INSERT OR IGNORE INTO active_points (t, lat, lng, acc) VALUES (?, ?, ?, ?)', p.t, p.lat, p.lng, p.acc);
}
export function activePoints(): TrackPoint[] {
  return runDb().getAllSync<TrackPoint>('SELECT t, lat, lng, acc FROM active_points ORDER BY t');
}
export function getState<T>(k: string): T | null {
  const row = runDb().getFirstSync<{ v: string }>('SELECT v FROM run_state WHERE k = ?', k);
  return row ? (JSON.parse(row.v) as T) : null;
}
export function setState(k: string, v: unknown) {
  runDb().runSync('INSERT OR REPLACE INTO run_state (k, v) VALUES (?, ?)', k, JSON.stringify(v));
}
export function clearActive() {
  runDb().execSync('DELETE FROM active_points; DELETE FROM run_state;');
}

type Row = Omit<LocalRun, 'splits' | 'synced'> & { splits: string; synced: number };
const toRun = (r: Row): LocalRun => ({ ...r, splits: JSON.parse(r.splits) as number[], synced: r.synced === 1 });

export function saveRun(r: Omit<LocalRun, 'synced'>) {
  runDb().runSync(
    'INSERT OR REPLACE INTO runs (id, started_at, ended_at, distance_m, moving_seconds, elapsed_seconds, avg_pace_sec_per_km, splits, steps, calories_est, calories_basis, route_polyline, point_count, event_id, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
    r.id, r.started_at, r.ended_at, r.distance_m, r.moving_seconds, r.elapsed_seconds, r.avg_pace_sec_per_km, JSON.stringify(r.splits), r.steps, r.calories_est, r.calories_basis, r.route_polyline, r.point_count, r.event_id,
  );
}
export function localRuns(): LocalRun[] {
  return runDb().getAllSync<Row>('SELECT * FROM runs ORDER BY started_at DESC').map(toRun);
}
export function unsyncedRuns(): LocalRun[] {
  return runDb().getAllSync<Row>('SELECT * FROM runs WHERE synced = 0 ORDER BY started_at').map(toRun);
}
export function markSynced(id: string) {
  runDb().runSync('UPDATE runs SET synced = 1 WHERE id = ?', id);
}
export function deleteLocalRun(id: string) {
  runDb().runSync('DELETE FROM runs WHERE id = ?', id);
}
/** Signing out or deleting the account: runs on this phone belong to that account. */
export function wipeLocalRuns() {
  runDb().execSync('DELETE FROM runs; DELETE FROM active_points; DELETE FROM run_state;');
}
