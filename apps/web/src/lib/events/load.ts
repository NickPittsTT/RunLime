import 'server-only';
import { isoToZonedLocal } from '@runlime/shared/events';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventFormValues } from '@/components/events/eventValues';

export const EVENT_COLUMNS =
  'id, slug, name, description, starts_at, timezone, status, status_reason, listing_source, organisation_id, region_id, venue_name, start_lat, start_lng, registration_url, registration_instructions, package_collection, parking, contact_email, contact_phone, cause, charity_name, walk_friendly, fee_min, fee_max, currency, route, published_at, duplicated_from_id, event_distances(distance_km, label)';

export interface EventRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  starts_at: string;
  timezone: string;
  status: string;
  status_reason: string | null;
  listing_source: 'organiser' | 'runlime';
  organisation_id: string | null;
  region_id: string;
  venue_name: string;
  start_lat: number;
  start_lng: number;
  registration_url: string | null;
  registration_instructions: string | null;
  package_collection: string | null;
  parking: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  cause: string | null;
  charity_name: string | null;
  walk_friendly: boolean;
  fee_min: number;
  fee_max: number | null;
  currency: string;
  route: [number, number][] | null;
  published_at: string | null;
  duplicated_from_id: string | null;
  event_distances: { distance_km: number; label: string }[];
}

export async function loadEvent(supabase: SupabaseClient, id: string): Promise<EventRow | null> {
  const { data } = await supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle();
  return (data as EventRow | null) ?? null;
}

export function toFormValues(e: EventRow): EventFormValues {
  return {
    id: e.id,
    listingSource: e.listing_source,
    organisationId: e.organisation_id ?? undefined,
    name: e.name,
    description: e.description ?? '',
    startsLocal: isoToZonedLocal(e.starts_at, e.timezone),
    timezone: e.timezone,
    regionId: e.region_id,
    venueName: e.venue_name,
    startLat: e.start_lat,
    startLng: e.start_lng,
    registrationUrl: e.registration_url ?? '',
    registrationInstructions: e.registration_instructions ?? '',
    packageCollection: e.package_collection ?? '',
    parking: e.parking ?? '',
    contactEmail: e.contact_email ?? '',
    contactPhone: e.contact_phone ?? '',
    cause: e.cause ?? '',
    charityName: e.charity_name ?? '',
    walkFriendly: e.walk_friendly,
    feeMin: Number(e.fee_min),
    feeMax: e.fee_max === null ? null : Number(e.fee_max),
    route: e.route,
    distances: e.event_distances.map((d) => ({ km: Number(d.distance_km), label: d.label })),
  };
}

export async function loadAreas(supabase: SupabaseClient) {
  const { data } = await supabase.from('regions').select('id, name').eq('kind', 'area').order('sort');
  return data ?? [];
}
