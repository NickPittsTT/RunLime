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

/** The device copy is per account, so a second person signing in on the same phone never inherits it. */
async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}
const localKey = (uid: string | null) => (uid ? `${KEY}.${uid}` : KEY);

async function readLocal(uid: string | null): Promise<Preferences | null> {
  try {
    const raw = await AsyncStorage.getItem(localKey(uid));
    if (!raw) return null;
    const p = preferencesSchema.safeParse(JSON.parse(raw));
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

async function writeLocal(uid: string | null, p: Preferences): Promise<void> {
  await AsyncStorage.setItem(localKey(uid), JSON.stringify(preferencesSchema.parse(p))).catch(() => undefined);
}

async function writeServer(uid: string | null, p: Preferences): Promise<boolean> {
  if (!uid) return false;
  const { error } = await supabase.from('user_preferences').upsert(
    { user_id: uid, region_ids: p.regionIds, distance_km: p.distanceKm, onboarded_at: p.onboarded ? new Date().toISOString() : null },
    { onConflict: 'user_id' },
  );
  return !error;
}

/** Account copy first; the device copy if offline. A device copy never synced (e.g. saved offline) is pushed up. */
export async function loadPreferences(): Promise<Preferences> {
  const uid = await currentUserId();
  const local = await readLocal(uid);
  try {
    const { data, error } = await supabase.from('user_preferences').select('region_ids, distance_km, onboarded_at').maybeSingle();
    if (error) throw error;
    const row = rowSchema.safeParse(data);
    if (row.success) {
      const p: Preferences = { onboarded: row.data.onboarded_at !== null, regionIds: row.data.region_ids, distanceKm: row.data.distance_km };
      await writeLocal(uid, p);
      return p;
    }
    if (local?.onboarded) await writeServer(uid, local);
  } catch {
    // Offline: fall back to the device copy.
  }
  return local ?? preferencesSchema.parse({});
}

/** Saves to the account and the device. Returns false if the account copy could not be saved (it syncs later). */
export async function savePreferences(p: Preferences): Promise<boolean> {
  const uid = await currentUserId();
  await writeLocal(uid, p);
  try {
    return await writeServer(uid, p);
  } catch {
    return false;
  }
}
