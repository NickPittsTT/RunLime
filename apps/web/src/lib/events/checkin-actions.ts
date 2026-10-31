'use server';
import { nominatimSearchUrl, parseNominatim, type GeocodeResult } from '@runlime/shared/location';
import { revalidatePath } from 'next/cache';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export interface VenueHit extends GeocodeResult {
  saved?: boolean;
}

/**
 * Venue search for the start pin (Phase 4). Saved venues (pins an admin already checked) come first; then Nominatim,
 * following the OSMF usage policy: called only when the user presses Search, an identifying User-Agent, results
 * cached for 30 days, and at most one request per second for the whole app (a shared slot in the database).
 */
export async function searchVenueAction(query: string): Promise<{ hits: VenueHit[]; error?: string }> {
  const q = query.trim();
  if (q.length < 3) return { hits: [], error: 'Type at least 3 characters, then press Search.' };
  if (q.length > 120) return { hits: [], error: 'That search is too long.' };
  const supabase = await createClient();
  const { data: saved, error: savedErr } = await supabase.rpc('search_venues', { p_query: q });
  if (savedErr) return { hits: [], error: friendlyError(savedErr) };
  const savedHits: VenueHit[] = ((saved ?? []) as { name: string; lat: number; lng: number }[]).map((v) => ({ label: `${v.name} (saved venue, pin checked)`, lat: v.lat, lng: v.lng, precision: 'exact', saved: true }));

  const { data: cached } = await supabase.rpc('geocode_cached', { p_query: q });
  if (Array.isArray(cached)) return { hits: [...savedHits, ...(cached as GeocodeResult[])] };
  const { data: slot } = await supabase.rpc('geocode_take_slot');
  if (!slot) return { hits: savedHits, error: 'The address search is busy. Wait a second and press Search again.' };
  try {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://runlime.app';
    const res = await fetch(nominatimSearchUrl(q), {
      headers: { 'User-Agent': `RunLime/0.4 (race calendar; +${site}/support)`, Referer: site, 'Accept-Language': 'en' },
      cache: 'no-store',
    });
    if (res.status === 429 || res.status === 403) return { hits: savedHits, error: 'The address search is limited right now. Place the pin on the map instead.' };
    if (!res.ok) return { hits: savedHits, error: 'The address search did not answer. Place the pin on the map instead.' };
    const hits = parseNominatim(await res.json());
    await supabase.rpc('geocode_store', { p_query: q, p_results: hits });
    return { hits: [...savedHits, ...hits] };
  } catch {
    return { hits: savedHits, error: 'The address search did not answer. Place the pin on the map instead.' };
  }
}

/** Admin: optional finish pin and per-race radius (empty = the setting). Re-tests failed attempts automatically. */
export async function setCheckinAreaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get('id'));
  const num = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v === '' ? null : Number(v);
  };
  const [flat, flng, radius] = [num('finishLat'), num('finishLng'), num('radius')];
  if ([flat, flng, radius].some((n) => n !== null && !Number.isFinite(n))) return { error: 'Use numbers only.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_set_checkin_area', { p_event: id, p_finish_lat: flat, p_finish_lng: flng, p_radius_m: radius === null ? null : Math.round(radius) });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/events/${id}`);
  const n = Number(data ?? 0);
  return { ok: n > 0 ? `Saved. ${n} earlier failed check-in${n === 1 ? '' : 's'} now pass${n === 1 ? 'es' : ''} and ${n === 1 ? 'was' : 'were'} approved after correction.` : 'Saved.' };
}

export async function approveCheckinAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_approve_checkin', { p_user: String(formData.get('user')), p_event: String(formData.get('event')), p_reason: String(formData.get('reason') ?? '') });
  if (error) return { error: friendlyError(error) };
  // No revalidate here: the decided request would vanish with its confirmation; the list updates on the next visit.
  return { ok: 'Checked in. The runner has been told.' };
}

export async function declineCheckinHelpAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_decline_checkin_help', { p_request: String(formData.get('request')), p_reason: String(formData.get('reason') ?? '') });
  if (error) return { error: friendlyError(error) };
  return { ok: 'Declined. The runner sees your reason.' };
}
