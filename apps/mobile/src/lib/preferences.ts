import AsyncStorage from '@react-native-async-storage/async-storage';
import { DISTANCE_CHOICES } from '@runlime/shared/events';
import { z } from 'zod';
import { supabase } from './supabase';

export { DISTANCE_CHOICES };

/**
 * Onboarding answers (M9): saved to the account (public.user_preferences) and copied on the device so the
 * calendar opens with them offline. Used as the default calendar filters.
 */
const KEY = 'runlime.preferences.v1';
export const preferencesSchema = z.object({
  onboarded: z.boolean().default(false),
  regionIds: z.array(z.string()).default([]),
  distanceKm: z.array(z.number()).default([]),
});
export type Preferences = z.infer<typeof preferencesSchema>;

const rowSchema = z.object({
  region_ids: z.array(z.string()),
  distance_km: z.array(z.coerce.number()),
  onboarded_at: z.string().nullable(),
});

async function readLocal(): Promise<Preferences | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const p = preferencesSchema.safeParse(JSON.parse(raw));
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

async function writeLocal(p: Preferences): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(preferencesSchema.parse(p))).catch(() => undefined);
}

async function writeServer(p: Preferences): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return false;
  const { error } = await supabase.from('user_preferences').upsert(
    { user_id: uid, region_ids: p.regionIds, distance_km: p.distanceKm, onboarded_at: p.onboarded ? new Date().toISOString() : null },
    { onConflict: 'user_id' },
  );
  return !error;
}

/** Account copy first; the device copy if offline. A device copy never synced (e.g. saved offline) is pushed up. */
export async function loadPreferences(): Promise<Preferences> {
  const local = await readLocal();
  try {
    const { data, error } = await supabase.from('user_preferences').select('region_ids, distance_km, onboarded_at').maybeSingle();
    if (error) throw error;
    const row = rowSchema.safeParse(data);
    if (row.success) {
      const p: Preferences = { onboarded: row.data.onboarded_at !== null, regionIds: row.data.region_ids, distanceKm: row.data.distance_km };
      await writeLocal(p);
      return p;
    }
    if (local?.onboarded) await writeServer(local);
  } catch {
    // Offline: fall back to the device copy.
  }
  return local ?? preferencesSchema.parse({});
}

/** Saves to the account and the device. Returns false if the account copy could not be saved (it syncs later). */
export async function savePreferences(p: Preferences): Promise<boolean> {
  await writeLocal(p);
  try {
    return await writeServer(p);
  } catch {
    return false;
  }
}
