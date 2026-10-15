import { z } from 'zod';

const url = z
  .string()
  .trim()
  .regex(/^https?:\/\/\S+$/i, 'Enter a full link starting with https://');
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));

export const eventDistanceSchema = z.object({
  km: z.coerce.number().positive('Distance must be more than 0').max(100),
  label: z.string().trim().min(1).max(30),
});

/** Route: [lng, lat] points (GeoJSON order), 2 to 2000 points. */
export const routeSchema = z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(2).max(2000);

/**
 * Event editor input (admin create + organiser editor). Mirrors public.save_event(p_event, p_distances).
 * `startsLocal` is the wall-clock time at the venue ("2031-03-01T06:00"); it is converted with the event's time zone.
 */
export const eventInputSchema = z
  .object({
    listingSource: z.enum(['organiser', 'runlime']),
    organisationId: z.uuid().optional(),
    name: z.string().trim().min(3, 'Name must be at least 3 characters').max(140),
    description: z.string().trim().max(5000).default(''),
    startsLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Choose the start date and time'),
    timezone: z.string().min(3).default('America/Port_of_Spain'),
    regionId: z.uuid('Choose an area'),
    venueName: z.string().trim().min(2, 'Venue is required').max(200),
    startLat: z.coerce.number().min(-90).max(90),
    startLng: z.coerce.number().min(-180).max(180),
    registrationUrl: url.optional().or(z.literal('').transform(() => undefined)),
    registrationInstructions: optionalText(2000),
    packageCollection: optionalText(2000),
    parking: optionalText(1000),
    contactEmail: z.email().optional().or(z.literal('').transform(() => undefined)),
    contactPhone: optionalText(30),
    cause: optionalText(200),
    charityName: optionalText(200),
    walkFriendly: z.boolean().default(false),
    feeMin: z.coerce.number().min(0).default(0),
    feeMax: z.coerce.number().min(0).optional(),
    route: routeSchema.optional(),
    distances: z.array(eventDistanceSchema).min(1, 'Add at least one distance').max(10),
  })
  .superRefine((v, ctx) => {
    if (v.listingSource === 'runlime' && !v.registrationUrl) {
      ctx.addIssue({ code: 'custom', path: ['registrationUrl'], message: 'RunLime listings need the official registration link' });
    }
    if (v.listingSource === 'organiser' && !v.organisationId) {
      ctx.addIssue({ code: 'custom', path: ['organisationId'], message: 'Choose the organisation' });
    }
    if (v.feeMax !== undefined && v.feeMax < v.feeMin) {
      ctx.addIssue({ code: 'custom', path: ['feeMax'], message: 'Maximum fee must be at least the minimum' });
    }
  });
export type EventInput = z.infer<typeof eventInputSchema>;

/**
 * Convert a wall-clock time in an IANA time zone to an ISO instant with offset.
 * Works for any zone (DST-safe for unambiguous times) without a date library.
 */
export function zonedLocalToIso(local: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error('Invalid local date-time');
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const offsetMin = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(instant));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return (Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - instant) / 60000;
  };
  // Two passes handle offsets that differ either side of a DST change.
  let instant = asUtc - offsetMin(asUtc) * 60000;
  instant = asUtc - offsetMin(instant) * 60000;
  return new Date(instant).toISOString();
}

/** The inverse: an instant shown as "YYYY-MM-DDTHH:mm" wall-clock time in the zone (for editing). */
export function isoToZonedLocal(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Payload for public.save_event (p_event, p_distances). */
export function toSaveEventPayload(v: EventInput) {
  return {
    event: {
      listing_source: v.listingSource,
      organisation_id: v.listingSource === 'organiser' ? v.organisationId : null,
      name: v.name,
      description: v.description,
      starts_at: zonedLocalToIso(v.startsLocal, v.timezone),
      timezone: v.timezone,
      region_id: v.regionId,
      venue_name: v.venueName,
      start_lat: v.startLat,
      start_lng: v.startLng,
      registration_url: v.registrationUrl ?? null,
      registration_instructions: v.registrationInstructions ?? null,
      package_collection: v.packageCollection ?? null,
      parking: v.parking ?? null,
      contact_email: v.contactEmail ?? null,
      contact_phone: v.contactPhone ?? null,
      cause: v.cause ?? null,
      charity_name: v.charityName ?? null,
      walk_friendly: v.walkFriendly,
      fee_min: v.feeMin,
      fee_max: v.feeMax ?? null,
      route: v.route ?? null,
    },
    distances: v.distances,
  };
}

/** Parse a GPX file's track/route points into [lng, lat] pairs (simple, dependency-free). */
export function parseGpx(xml: string, maxPoints = 2000): [number, number][] {
  const pts: [number, number][] = [];
  const re = /<(?:trkpt|rtept)\b[^>]*?\blat="(-?[\d.]+)"[^>]*?\blon="(-?[\d.]+)"|<(?:trkpt|rtept)\b[^>]*?\blon="(-?[\d.]+)"[^>]*?\blat="(-?[\d.]+)"/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const lat = Number(m[1] ?? m[4]);
    const lng = Number(m[2] ?? m[3]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push([lng, lat]);
  }
  if (pts.length <= maxPoints) return pts;
  // Downsample evenly, keeping the first and last points.
  const step = (pts.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => pts[Math.round(i * step)]!);
}

export const raceSuggestionSchema = z.object({
  name: z.string().trim().min(3, 'Race name is required').max(140),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
  location: optionalText(200),
  url: url.optional().or(z.literal('').transform(() => undefined)),
  notes: optionalText(1000),
});
export type RaceSuggestionInput = z.infer<typeof raceSuggestionSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(['postponed', 'cancelled', 'published']),
  reason: z.string().trim().max(500).default(''),
  newStartsLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
});
