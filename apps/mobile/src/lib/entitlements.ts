import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Entitlement check (Phase 7 wires it to plans). The tracker is free for everyone until then (feature.tracker).
 * Offline, the last known answer is used; with none, the tracker is allowed (free until Phase 7).
 */
let cached: Record<string, boolean> | null = null;
export async function loadEntitlements(): Promise<Record<string, boolean>> {
  const { data, error } = await supabase.rpc('my_entitlements');
  if (!error && data && typeof data === 'object') cached = data as Record<string, boolean>;
  return cached ?? { tracker: true };
}
export function useEntitlement(feature: 'tracker'): boolean | null {
  const [value, setValue] = useState<boolean | null>(cached ? (cached[feature] ?? false) : null);
  useEffect(() => {
    let active = true;
    void loadEntitlements().then((e) => active && setValue(e[feature] ?? false));
    return () => {
      active = false;
    };
  }, [feature]);
  return value;
}
