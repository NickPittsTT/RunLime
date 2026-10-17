import AsyncStorage from '@react-native-async-storage/async-storage';
import { calendarEventSchema } from '@runlime/shared/events';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { config } from './config';
import { supabase } from './supabase';

const DETAIL_COLUMNS =
  'id, slug, name, description, starts_at, timezone, status, status_reason, listing_source, region_id, venue_name, start_lat, start_lng, route, registration_url, registration_instructions, package_collection, parking, contact_email, contact_phone, cause, charity_name, walk_friendly, fee_min, fee_max, currency, regions!events_region_id_fkey(name), distances:event_distances(distance_km, label), event_media(id, kind, storage_path, alt_text, sort), event_sponsors(id, name, url, sort)';

const text = z.string().nullable().optional().transform((v) => v ?? null);
export const raceDetailSchema = calendarEventSchema.extend({
  description: z.string().nullable().transform((v) => v ?? ''),
  status_reason: text,
  route: z.array(z.tuple([z.number(), z.number()])).nullable().optional().transform((v) => v ?? null),
  registration_url: text,
  registration_instructions: text,
  package_collection: text,
  parking: text,
  contact_email: text,
  contact_phone: text,
  charity_name: text,
  regions: z.object({ name: z.string() }).nullable().optional(),
  event_media: z.array(z.object({ id: z.string(), kind: z.string(), storage_path: z.string(), alt_text: z.string().nullable(), sort: z.number() })).default([]),
  event_sponsors: z.array(z.object({ id: z.string(), name: z.string(), url: z.string().nullable(), sort: z.number() })).default([]),
});
export type RaceDetail = z.infer<typeof raceDetailSchema>;

export function eventMediaUrl(path: string): string {
  return `${config.supabaseUrl}/storage/v1/object/public/event-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function raceWebUrl(slug: string): string {
  return `${config.webUrl}/e/${encodeURIComponent(slug)}`;
}

type RaceLoad =
  | { state: 'ready'; race: RaceDetail; updatedAt: string; offline: boolean }
  | { state: 'notFound' | 'error'; race: null; updatedAt: null; offline: boolean };

const cacheKey = (id: string) => `runlime.race.v1.${id}`;
const cachedSchema = z.object({ savedAt: z.string(), race: z.unknown() });

/** Fresh from the server; if offline, the last copy saved on this phone (with when it was saved). */
export async function fetchRace(id: string): Promise<RaceLoad> {
  const { data, error } = await supabase.from('events').select(DETAIL_COLUMNS).eq('id', id).in('status', ['published', 'postponed', 'cancelled']).maybeSingle();
  if (error) {
    try {
      const raw = await AsyncStorage.getItem(cacheKey(id));
      const c = cachedSchema.safeParse(raw ? JSON.parse(raw) : null);
      const race = c.success ? raceDetailSchema.safeParse(c.data.race) : null;
      if (c.success && race?.success) return { state: 'ready', race: race.data, updatedAt: c.data.savedAt, offline: true };
    } catch {
      // fall through
    }
    return { state: 'error', race: null, updatedAt: null, offline: true };
  }
  const parsed = raceDetailSchema.safeParse(data);
  if (!data || !parsed.success) {
    await AsyncStorage.removeItem(cacheKey(id)).catch(() => undefined);
    return { state: 'notFound', race: null, updatedAt: null, offline: false };
  }
  const savedAt = new Date().toISOString();
  await AsyncStorage.setItem(cacheKey(id), JSON.stringify({ savedAt, race: data })).catch(() => undefined);
  return { state: 'ready', race: parsed.data, updatedAt: savedAt, offline: false };
}

/** One public race (published, postponed or cancelled). */
export function useRace(id: string | undefined) {
  const [race, setRace] = useState<RaceDetail | null>(null);
  const [state, setState] = useState<'loading' | RaceLoad['state']>('loading');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const apply = useCallback((r: RaceLoad) => {
    if (r.race) {
      setRace(r.race);
      setUpdatedAt(r.updatedAt);
    }
    if (r.state === 'notFound') setRace(null);
    setOffline(r.offline);
    // Keep showing what we have if a refresh fails while offline.
    setState((prev) => (r.state === 'error' && prev === 'ready' ? prev : r.state));
    setRefreshing(false);
  }, []);
  useEffect(() => {
    if (id) void fetchRace(id).then(apply);
  }, [id, apply]);
  const reload = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    apply(await fetchRace(id));
  }, [id, apply]);
  return { race, state, reload, updatedAt, offline, refreshing };
}
