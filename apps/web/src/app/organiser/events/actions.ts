'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export async function acceptInvite(formData: FormData) {
  const supabase = await createClient();
  const event = String(formData.get('event'));
  await supabase.rpc('accept_co_organiser', { p_event: event });
  redirect(`/organiser/events/${event}`);
}

export async function inviteCoOrganiser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email.' };
  const supabase = await createClient();
  const event = String(formData.get('event'));
  const { error } = await supabase.rpc('invite_co_organiser', { p_event: event, p_email: email });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/organiser/events/${event}`);
  return { ok: 'Invitation sent. They accept it in their organiser portal.' };
}

export async function removeCoOrganiser(formData: FormData) {
  const supabase = await createClient();
  const event = String(formData.get('event'));
  await supabase.rpc('remove_co_organiser', { p_event: event, p_user: String(formData.get('user')) });
  revalidatePath(`/organiser/events/${event}`);
}

/** Record an image already uploaded to storage (event-media/<event>/<file>). */
export async function addMedia(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const event = String(formData.get('event'));
  const path = String(formData.get('path') ?? '');
  const alt = String(formData.get('alt') ?? '').trim();
  const kind = String(formData.get('kind') ?? 'flyer');
  if (!path.startsWith(`${event}/`)) return { error: 'Upload failed. Try again.' };
  if (alt.length < 3) return { error: 'Describe the image for people using screen readers (alt text).' };
  const supabase = await createClient();
  const { error } = await supabase.from('event_media').insert({ event_id: event, storage_path: path, alt_text: alt, kind });
  if (error) {
    await supabase.storage.from('event-media').remove([path]);
    return { error: friendlyError(error) };
  }
  revalidatePath(`/organiser/events/${event}`);
  return { ok: 'Image added.' };
}

export async function removeMedia(formData: FormData) {
  const supabase = await createClient();
  const event = String(formData.get('event'));
  const id = String(formData.get('id'));
  const { data } = await supabase.from('event_media').delete().eq('id', id).select('storage_path').maybeSingle();
  if (data?.storage_path) await supabase.storage.from('event-media').remove([data.storage_path]);
  revalidatePath(`/organiser/events/${event}`);
}

export async function addSponsor(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const event = String(formData.get('event'));
  const name = String(formData.get('name') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  if (name.length < 2) return { error: 'Enter the sponsor name.' };
  if (url && !/^https?:\/\/\S+$/i.test(url)) return { error: 'Enter a full link starting with https://' };
  const supabase = await createClient();
  const { error } = await supabase.from('event_sponsors').insert({ event_id: event, name, url: url || null });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/organiser/events/${event}`);
  return { ok: 'Sponsor added.' };
}

export async function removeSponsor(formData: FormData) {
  const supabase = await createClient();
  const event = String(formData.get('event'));
  await supabase.from('event_sponsors').delete().eq('id', String(formData.get('id')));
  revalidatePath(`/organiser/events/${event}`);
}
