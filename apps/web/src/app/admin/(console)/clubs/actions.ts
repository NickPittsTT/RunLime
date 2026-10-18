'use server';
import { clubSchema } from '@runlime/shared/schemas';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export async function saveClub(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = formData.get('id') ? String(formData.get('id')) : null;
  const parsed = clubSchema.safeParse({
    name: formData.get('name'),
    description: (formData.get('description') as string) || undefined,
    regionId: (formData.get('regionId') as string) || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const supabase = await createClient();
  const row = { name: parsed.data.name, description: parsed.data.description ?? null, region_id: parsed.data.regionId };
  const { error } = id ? await supabase.from('clubs').update(row).eq('id', id) : await supabase.from('clubs').insert(row);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/admin/clubs');
  return { ok: id ? 'Club updated.' : 'Club created.' };
}

export async function setClubArchived(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from('clubs')
    .update({ archived_at: formData.get('archive') === 'true' ? new Date().toISOString() : null })
    .eq('id', String(formData.get('id')));
  revalidatePath('/admin/clubs');
}

/** Approve (creates the club; the requester joins, as its first leader if ticked) or reject with a reason. */
export async function reviewClubRequest(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const approve = formData.get('decision') === 'approve';
  const { error } = await supabase.rpc('admin_review_club_request', {
    p_request: String(formData.get('id')),
    p_approve: approve,
    p_make_leader: formData.get('makeLeader') === 'on',
    p_note: String(formData.get('note') ?? ''),
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/admin/clubs');
  redirect(`/admin/clubs?done=${approve ? 'approved' : 'rejected'}`);
}

/** Appoint or remove a club leader by the person's email (they become an approved member if they weren't). */
export async function setClubLeader(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const leader = formData.get('leader') !== 'false';
  let userId = String(formData.get('userId') ?? '');
  if (!userId) {
    if (!email.includes('@')) return { error: 'Enter the person\'s account email.' };
    const { data } = await supabase.rpc('admin_list_users', { p_search: email, p_limit: 5, p_offset: 0 });
    const match = ((data ?? []) as { id: string; email: string }[]).find((u) => u.email.toLowerCase() === email);
    if (!match) return { error: 'No RunLime account uses that email.' };
    userId = match.id;
  }
  const { error } = await supabase.rpc('admin_set_club_leader', { p_club: String(formData.get('clubId')), p_user: userId, p_leader: leader });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/admin/clubs');
  return { ok: leader ? 'Leader appointed.' : 'Leader role removed (still a member).' };
}
