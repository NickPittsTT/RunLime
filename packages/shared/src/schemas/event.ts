import { z } from 'zod';
import { zonedLocalToIso } from '../events/time';

export { isoToZonedLocal, parseGpx, zonedLocalToIso } from '../events/time';

const url = z
  .string()
  .trim()
  .regex(/^https?:\/\/\S+$/i, 'Enter a full link starting with https://');
/** Optional free text: blank (or whitespace-only) becomes undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

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
