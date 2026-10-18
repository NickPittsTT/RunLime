import { z } from 'zod';
import { supabase } from './supabase';

const person = z.object({ id: z.string(), display_name: z.string(), nickname: z.string().nullable().optional().transform((v) => v ?? null), avatar_path: z.string().nullable().optional().transform((v) => v ?? null) });
export type Person = z.infer<typeof person>;

const card = person.extend({
  runner_level: z.string().nullable(),
  account_privacy: z.enum(['private', 'public']),
  is_me: z.boolean(),
  following: z.enum(['pending', 'accepted']).nullable(),
  follows_you: z.enum(['pending', 'accepted']).nullable(),
  followers: z.coerce.number(),
  following_count: z.coerce.number(),
  can_see_details: z.boolean(),
});
export type ProfileCard = z.infer<typeof card>;

const passport = z.object({
  races_attended: z.coerce.number(),
  total_km: z.coerce.number(),
  attending: z.array(z.object({ id: z.string(), name: z.string(), starts_at: z.string(), timezone: z.string(), status: z.string(), venue_name: z.string() })),
});
export type Passport = z.infer<typeof passport>;

const connections = z.object({
  followers: z.array(person),
  following: z.array(person),
  requests: z.array(person),
  sent: z.array(person),
  blocked: z.array(z.object({ id: z.string(), display_name: z.string() })),
});
export type Connections = z.infer<typeof connections>;

type Err = { message?: string; code?: string } | null;

export async function searchPeople(q: string): Promise<Person[]> {
  const { data, error } = await supabase.rpc('search_people', { p_query: q });
  if (error) throw error;
  return z.array(person).parse(data ?? []);
}

export async function fetchProfileCard(id: string): Promise<ProfileCard | null> {
  const { data, error } = await supabase.rpc('profile_card', { p_user: id });
  if (error) {
    if (error.code === 'P0002') return null;
    throw error;
  }
  return card.parse(data);
}

export async function fetchPassport(id: string): Promise<Passport | null> {
  const { data, error } = await supabase.rpc('profile_passport', { p_user: id });
  if (error) return null;
  return passport.parse(data);
}

/** M19: people you follow (approved) who are going to a race. */
export async function fetchFollowingGoing(eventId: string): Promise<Person[]> {
  try {
    const { data, error } = await supabase.rpc('following_going', { p_event: eventId });
    return error ? [] : z.array(person).parse(data ?? []);
  } catch {
    return [];
  }
}

export async function fetchConnections(): Promise<Connections> {
  const { data, error } = await supabase.rpc('my_connections');
  if (error) throw error;
  return connections.parse(data);
}

const call = async (fn: string, args: Record<string, unknown>): Promise<Err> => (await supabase.rpc(fn, args)).error;
export const followUser = (id: string) => call('follow_user', { p_user: id });
export const unfollowUser = (id: string) => call('unfollow_user', { p_user: id });
export const respondRequest = (id: string, accept: boolean) => call('respond_follow_request', { p_follower: id, p_accept: accept });
export const removeFollower = (id: string) => call('remove_follower', { p_follower: id });
export const blockUser = (id: string) => call('block_user', { p_user: id });
export const unblockUser = (id: string) => call('unblock_user', { p_user: id });
