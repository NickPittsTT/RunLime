/**
 * Profiles, reports and (later in Phase 3) RSVPs, followers and clubs: labels and rules shared by web and app.
 */
import { z } from 'zod';

/** Self-declared, optional, profile only. It never changes speed checks (CLAUDE.md guardrail). */
export const RUNNER_LEVELS = [
  { value: 'casual', label: 'Casual', help: 'I run for fun and fitness.' },
  { value: 'club_runner', label: 'Club runner', help: 'I train regularly, often with a club.' },
  { value: 'competitive', label: 'Competitive', help: 'I race for times and places.' },
] as const;
export type RunnerLevel = (typeof RUNNER_LEVELS)[number]['value'];
export const RUNNER_LEVEL_NOTE = 'Just for your profile. It never changes how runs or times are checked.';

export function runnerLevelLabel(v: string | null | undefined): string | null {
  return RUNNER_LEVELS.find((l) => l.value === v)?.label ?? null;
}

export const REPORT_CATEGORIES = [
  { value: 'child_safety', label: 'A child may be at risk' },
  { value: 'sexual_content', label: 'Nudity or sexual content' },
  { value: 'harassment', label: 'Bullying or harassment' },
  { value: 'hate_or_violence', label: 'Hate or violence' },
  { value: 'impersonation', label: 'Pretending to be someone else' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'other', label: 'Something else' },
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]['value'];
export type ReportTarget = 'profile_photo' | 'profile' | 'club' | 'event' | 'general';

export const reportSchema = z
  .object({
    category: z.enum(REPORT_CATEGORIES.map((c) => c.value) as [ReportCategory, ...ReportCategory[]], { message: 'Choose what is wrong.' }),
    targetKind: z.enum(['profile_photo', 'profile', 'club', 'event', 'general']),
    targetUserId: z.string().uuid().nullable().default(null),
    targetRef: z.string().max(200).nullable().default(null),
    details: z.string().trim().max(1000, 'Please keep it under 1,000 characters.').default(''),
  })
  .refine((r) => r.targetKind !== 'general' || r.details.length >= 10, {
    path: ['details'],
    message: 'Please describe the concern in at least 10 characters.',
  });
export type ReportInput = z.infer<typeof reportSchema>;

/** Public URL of a profile photo (public "avatars" bucket; random file names). */
export function avatarUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  return path ? `${supabaseUrl}/storage/v1/object/public/avatars/${path}` : null;
}
