import * as Location from 'expo-location';
import { z } from 'zod';
import { supabase } from './supabase';

/**
 * GPS check-in (Phase 4). Location permission is "while the app is open" only (owner decision). One fresh position
 * is read when the runner taps Check in and sent to check_in(), which decides; the server stores it rounded to 3 dp.
 */
export type Fix = { status: 'ok'; lat: number; lng: number; accuracy: number } | { status: 'denied' } | { status: 'unavailable' };

export async function readCheckinPosition(): Promise<Fix> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { status: 'denied' };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true });
    return { status: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? 0 };
  } catch {
    return { status: 'unavailable' };
  }
}

const resultSchema = z.object({
  result: z.enum(['ok', 'already', 'too_far', 'too_early', 'too_late', 'not_live']),
  distance_m: z.number().optional(),
  radius_m: z.number().optional(),
  opens_at: z.string().optional(),
  closes_at: z.string().optional(),
});
export type CheckinResult = z.infer<typeof resultSchema>;

export async function checkIn(eventId: string, fix: { lat: number; lng: number; accuracy: number }): Promise<{ result?: CheckinResult; error?: { code?: string; message?: string } }> {
  const { data, error } = await supabase.rpc('check_in', { p_event: eventId, p_lat: fix.lat, p_lng: fix.lng, p_accuracy_m: fix.accuracy });
  if (error) return { error };
  const parsed = resultSchema.safeParse(data);
  return parsed.success ? { result: parsed.data } : { error: { message: 'Unexpected answer' } };
}

const statusSchema = z.object({
  checked_in: z.boolean(),
  checked_in_at: z.string().nullable(),
  check_in_status: z.enum(['gps', 'approved_after_correction', 'manual']).nullable(),
  opens_at: z.string(),
  closes_at: z.string(),
  radius_m: z.number(),
  live: z.boolean(),
  help_request: z.enum(['pending', 'approved', 'declined']).nullable(),
});
export type CheckinStatus = z.infer<typeof statusSchema>;

export async function fetchCheckinStatus(eventId: string): Promise<CheckinStatus | null> {
  const { data, error } = await supabase.rpc('my_checkin_status', { p_event: eventId });
  if (error) return null;
  const parsed = statusSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function requestCheckinHelp(eventId: string, note: string) {
  const { error } = await supabase.rpc('request_checkin_help', { p_event: eventId, p_note: note.trim() || null });
  return error;
}

/** Where the window stands right now. */
export function windowState(s: Pick<CheckinStatus, 'opens_at' | 'closes_at' | 'live'>, now = Date.now()): 'not_live' | 'before' | 'open' | 'after' {
  if (!s.live) return 'not_live';
  if (now < Date.parse(s.opens_at)) return 'before';
  if (now > Date.parse(s.closes_at)) return 'after';
  return 'open';
}
