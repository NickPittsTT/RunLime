import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { supabase } from './supabase';

const CACHE_KEY = 'runlime.publicSettings.v1';
const rowsSchema = z.array(z.object({ key: z.string(), value: z.unknown() }));
export type PublicSettings = Record<string, unknown>;

/** Public settings (RLS returns only is_public rows to non-admins). Cached for offline use. */
export function usePublicSettings(): PublicSettings | null {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value');
      const parsed = rowsSchema.safeParse(data);
      if (!error && parsed.success) {
        const map = Object.fromEntries(parsed.data.map((r) => [r.key, r.value]));
        if (active) setSettings(map);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map)).catch(() => undefined);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        const cached = z.record(z.string(), z.unknown()).safeParse(raw ? JSON.parse(raw) : null);
        if (active) setSettings(cached.success ? cached.data : {});
      } catch {
        if (active) setSettings({});
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return settings;
}

export function settingText(s: PublicSettings | null, key: string): string | null {
  const v = s?.[key];
  return typeof v === 'string' ? v : null;
}

export function settingNumber(s: PublicSettings | null, key: string, fallback: number): number {
  const v = Number(s?.[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
