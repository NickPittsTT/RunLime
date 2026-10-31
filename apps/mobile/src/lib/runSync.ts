import { z } from 'zod';
import { deleteLocalRun, localRuns, markSynced, unsyncedRuns, type LocalRun } from './runDb';
import { supabase } from './supabase';

/** Uploads finished runs that haven't reached the server yet (the outbox). Safe to call any time; retries later. */
export async function syncRuns(): Promise<{ uploaded: number; waiting: number }> {
  let uploaded = 0;
  const pending = unsyncedRuns();
  for (const r of pending) {
    const { synced: _s, event_id: _e, ...payload } = r;
    const { error } = await supabase.rpc('upsert_run', { p_run: { ...payload, device_meta: { app: 'runlime-android' } } });
    if (error) break; // offline or refused: keep it for the next try
    markSynced(r.id);
    uploaded++;
  }
  return { uploaded, waiting: pending.length - uploaded };
}

const serverRun = z.object({
  id: z.string(),
  started_at: z.string(),
  ended_at: z.string(),
  distance_m: z.number(),
  moving_seconds: z.number(),
  elapsed_seconds: z.number(),
  avg_pace_sec_per_km: z.number().nullable(),
  splits: z.array(z.number()),
  steps: z.number().nullable(),
  calories_est: z.number().nullable(),
  calories_basis: z.enum(['weight', 'general']).nullable(),
  route_polyline: z.string().nullable(),
  point_count: z.number(),
  event_id: z.string().nullable(),
  events: z.object({ name: z.string() }).nullable().optional(),
});
export type RunItem = LocalRun & { raceName: string | null };

/** History: runs on the server plus any on this phone that are still waiting to upload. Newest first. */
export async function loadRuns(): Promise<{ runs: RunItem[]; offline: boolean }> {
  const local = localRuns();
  const { data, error } = await supabase
    .from('runs')
    .select('id, started_at, ended_at, distance_m, moving_seconds, elapsed_seconds, avg_pace_sec_per_km, splits, steps, calories_est, calories_basis, route_polyline, point_count, event_id, events(name)')
    .order('started_at', { ascending: false })
    .limit(500);
  if (error || !Array.isArray(data)) return { runs: local.map((r) => ({ ...r, raceName: null })), offline: true };
  const server = z.array(serverRun).safeParse(data);
  const fromServer: RunItem[] = (server.success ? server.data : []).map((r) => ({ ...r, route_polyline: r.route_polyline ?? '', synced: true, raceName: r.events?.name ?? null }));
  const ids = new Set(fromServer.map((r) => r.id));
  const waiting = local.filter((r) => !r.synced && !ids.has(r.id)).map((r) => ({ ...r, raceName: null }));
  return { runs: [...waiting, ...fromServer].sort((a, b) => b.started_at.localeCompare(a.started_at)), offline: false };
}

const totalsSchema = z.object({
  runs: z.number(),
  distance_m: z.number(),
  moving_seconds: z.number(),
  races_attended: z.number(),
  per_race: z.array(z.object({ event_id: z.string(), name: z.string(), starts_at: z.string(), runs: z.number(), distance_m: z.number(), moving_seconds: z.number() })),
});
export type ServerTotals = z.infer<typeof totalsSchema>;
export async function loadTotals(): Promise<ServerTotals | null> {
  const { data, error } = await supabase.rpc('my_run_totals');
  if (error) return null;
  const parsed = totalsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function deleteRun(id: string): Promise<boolean> {
  const { error } = await supabase.rpc('delete_run', { p_id: id });
  if (error) return false;
  deleteLocalRun(id);
  return true;
}
