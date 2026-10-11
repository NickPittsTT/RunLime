import { z } from 'zod';

export const organiserApplicationSchema = z.object({
  organisationName: z.string().trim().min(2).max(120),
  contactEmail: z.email(),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number'),
  website: z.url().optional().or(z.literal('')),
  about: z.string().trim().min(20, 'Tell us a little more (20+ characters)').max(2000),
  isCharity: z.boolean(),
});
export type OrganiserApplicationInput = z.infer<typeof organiserApplicationSchema>;

export const rejectionSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export const clubSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  regionId: z.uuid().nullable(),
});
export type ClubInput = z.infer<typeof clubSchema>;
