import AsyncStorage from '@react-native-async-storage/async-storage';
import { evaluateAgeGate, type AgeGateResult } from '@runlime/shared/rules';

/**
 * Device-only age gate state (F1). The date of birth of a blocked person never leaves the phone and is not kept:
 * we only store the time of the block, to deter immediate retries.
 */
const BLOCK_KEY = 'runlime.ageBlockedAt';
const BLOCK_MS = 24 * 60 * 60 * 1000;

export async function isRecentlyBlocked(now = Date.now()): Promise<boolean> {
  const at = Number((await AsyncStorage.getItem(BLOCK_KEY)) ?? 0);
  return at > 0 && now - at < BLOCK_MS;
}

export async function recordBlocked(now = Date.now()): Promise<void> {
  await AsyncStorage.setItem(BLOCK_KEY, String(now));
}

/** Build an ISO date from separate day/month/year inputs. Returns null when incomplete. */
export function toIsoDate(day: string, month: string, year: string): string | null {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export async function runAgeGate(day: string, month: string, year: string): Promise<AgeGateResult> {
  const iso = toIsoDate(day, month, year);
  if (!iso) return { status: 'invalid', reason: 'format' };
  const result = evaluateAgeGate(iso);
  if (result.status === 'blocked') await recordBlocked();
  return result;
}
