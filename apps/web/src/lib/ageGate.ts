'use client';
import { useSyncExternalStore } from 'react';
import { AGE_REFERENCE_TIME_ZONE, evaluateAgeGate, todayIn, type AgeGateResult } from '@runlime/shared/rules';

const DOB_KEY = 'runlime.dob';
const BLOCK_KEY = 'runlime.ageBlockedAt';
const BLOCK_MS = 24 * 60 * 60 * 1000;

/** Device-only state. Nothing about a blocked person ever leaves the browser. */
export function checkDob(dob: string): AgeGateResult {
  const result = evaluateAgeGate(dob, todayIn(AGE_REFERENCE_TIME_ZONE));
  try {
    if (result.status === 'allowed') sessionStorage.setItem(DOB_KEY, dob);
    if (result.status === 'blocked') {
      sessionStorage.removeItem(DOB_KEY);
      localStorage.setItem(BLOCK_KEY, String(Date.now()));
    }
  } catch {
    // storage unavailable: the gate still applies for this page view
  }
  return result;
}

export function getPassedDob(): string | null {
  try {
    const dob = sessionStorage.getItem(DOB_KEY);
    return dob && evaluateAgeGate(dob).status === 'allowed' ? dob : null;
  } catch {
    return null;
  }
}

export function clearPassedDob() {
  try {
    sessionStorage.removeItem(DOB_KEY);
  } catch {
    /* ignore */
  }
}

export function isRecentlyBlocked(): boolean {
  try {
    const at = Number(localStorage.getItem(BLOCK_KEY) ?? 0);
    return at > 0 && Date.now() - at < BLOCK_MS;
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};
/** Reads a browser-only value without a hydration mismatch. `undefined` while server rendering / hydrating. */
export function useBrowserValue<T>(get: () => T): T | undefined {
  return useSyncExternalStore(noopSubscribe, get, () => undefined);
}
