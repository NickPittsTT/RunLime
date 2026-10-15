import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

/** Onboarding answers (M9). Stored on this device only; used as the default calendar filters. */
const KEY = 'runlime.preferences.v1';
export const preferencesSchema = z.object({
  onboarded: z.boolean().default(false),
  regionIds: z.array(z.string()).default([]),
  distanceKm: z.array(z.number()).default([]),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const DISTANCE_CHOICES = [
  { km: 5, label: '5K' },
  { km: 10, label: '10K' },
  { km: 21.1, label: 'Half marathon' },
  { km: 42.2, label: 'Marathon' },
] as const;

export async function loadPreferences(): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const p = preferencesSchema.safeParse(raw ? JSON.parse(raw) : {});
    return p.success ? p.data : preferencesSchema.parse({});
  } catch {
    return preferencesSchema.parse({});
  }
}

export async function savePreferences(p: Preferences): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(preferencesSchema.parse(p)));
}
