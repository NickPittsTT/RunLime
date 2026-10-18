import { z } from 'zod';
import { supabase } from './supabase';

const status = z.enum(['pending', 'approved']).nullable();
const role = z.enum(['member', 'leader']).nullable();
const dirRow = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  area: z.string().nullable(),
  members: z.coerce.number(),
  my_status: status,
  my_role: role,
  is_primary: z.boolean(),
});
export type ClubRow = z.infer<typeof dirRow>;
const personLite = z.object({ id: z.string(), display_name: z.string(), nickname: z.string().nullable().optional().transform((v) => v ?? null), avatar_path: z.string().nullable() });
const page = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  area: z.string().nullable(),
  members: z.coerce.number(),
  leaders: z.array(personLite),
  me: z.object({ status: z.enum(['pending', 'approved']), role: z.enum(['member', 'leader']), is_primary: z.boolean() }).nullable(),
  is_leader: z.boolean(),
  requests: z.array(personLite).nullable(),
  member_list: z.array(personLite.extend({ role: z.enum(['member', 'leader']) })).nullable(),
});
export type ClubPage = z.infer<typeof page>;
type Err = { message?: string; code?: string } | null;

export async function fetchClubDirectory(q?: string): Promise<ClubRow[]> {
  const { data, error } = await supabase.rpc('club_directory', { p_query: q ?? null });
  if (error) throw error;
  return z.array(dirRow).parse(data ?? []);
}

export async function fetchClubPage(id: string): Promise<ClubPage | null> {
  const { data, error } = await supabase.rpc('club_page', { p_club: id });
  if (error) {
    if (error.code === 'P0002') return null;
    throw error;
  }
  return page.parse(data);
}

/** Race page: "Club X: N going" (opted-in approved members only; hidden below the minimum). */
export async function fetchClubTurnout(eventId: string): Promise<{ club_id: string; club_name: string; going: number }[]> {
  try {
    const { data, error } = await supabase.rpc('club_turnout', { p_event: eventId });
    if (error || !Array.isArray(data)) return [];
    return (data as { club_id: string; club_name: string; going: number }[]).map((r) => ({ ...r, going: Number(r.going) }));
  } catch {
    return [];
  }
}

const call = async (fn: string, args: Record<string, unknown>): Promise<Err> => (await supabase.rpc(fn, args)).error;
export const requestJoin = (club: string) => call('request_join_club', { p_club: club });
export const leaveClub = (club: string) => call('leave_club', { p_club: club });
export const respondJoin = (club: string, user: string, accept: boolean) => call('respond_club_request', { p_club: club, p_user: user, p_accept: accept });
export const removeMember = (club: string, user: string) => call('remove_club_member', { p_club: club, p_user: user });
export const setPrimaryClub = (club: string | null) => call('set_primary_club', { p_club: club });
export const requestNewClub = (name: string, description: string | null, regionId: string | null) =>
  call('request_new_club', { p_name: name, p_description: description, p_region: regionId });
