import { z } from 'zod';
import { isAdult } from '../rules/age';

export const NICKNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,28}[A-Za-z0-9]$/;

export const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((v) => isAdult(v), { message: 'RunLime accounts are for adults aged 18 and over.' });

export const displayNameSchema = z.string().trim().min(1, 'Enter a name').max(50, 'Keep it under 50 characters');

export const nicknameSchema = z
  .string()
  .trim()
  .regex(NICKNAME_PATTERN, '3–30 letters, numbers, spaces, dots, dashes or underscores');

export const completeSignupSchema = z.object({
  dateOfBirth: dateOfBirthSchema,
  displayName: displayNameSchema,
  nickname: nicknameSchema.optional(),
  homeRegionId: z.uuid(),
  termsVersion: z.string().min(1),
  privacyVersion: z.string().min(1),
});
export type CompleteSignupInput = z.infer<typeof completeSignupSchema>;

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema,
  nickname: nicknameSchema.nullable(),
  homeRegionId: z.uuid(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number'),
  relationship: z.string().trim().max(40).optional(),
});
export type EmergencyContact = z.infer<typeof emergencyContactSchema>;
