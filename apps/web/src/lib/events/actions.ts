'use server';
import { eventInputSchema, raceSuggestionSchema, statusChangeSchema, toSaveEventPayload, zonedLocalToIso } from '@runlime/shared/schemas';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

/** Create or update an event (admin listings and organiser events). Form field `payload` is JSON from EventForm. */
export async function saveEventAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = (formData.get('id') as string) || null;
  const back = String(formData.get('back') ?? '/organiser');
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get('payload') ?? '{}'));
  } catch {
    return { error: 'Check the form and try again.' };
  }
  const parsed = eventInputSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const { event, distances } = toSaveEventPayload(parsed.data);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('save_event', { p_id: id, p_event: event, p_distances: distances });
  if (error) return { error: friendlyError(error) };
  const suggestion = formData.get('suggestion');
  if (suggestion && !id) {
    await supabase.rpc('review_race_suggestion', { p_id: String(suggestion), p_status: 'converted', p_event: data });
  }
  revalidatePath(back);
  redirect(`${back}/${data as string}?saved=1`);
}

export async function submitEventAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id'));
  const { error } = await supabase.rpc('submit_event', { p_id: id });
  const back = String(formData.get('back'));
  redirect(`${back}/${id}?${error ? `error=${encodeURIComponent(friendlyError(error))}` : 'submitted=1'}`);
}

export async function reviewEventAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const id = String(formData.get('id'));
  const decision = String(formData.get('decision'));
  const { error } = await supabase.rpc('review_event', { p_id: id, p_decision: decision, p_reason: (formData.get('reason') as string) || null });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/admin/events');
  revalidatePath(`/admin/events/${id}`);
  return { ok: decision === 'published' ? 'Published.' : decision === 'rejected' ? 'Rejected. The organiser sees your reason.' : 'Unpublished.' };
}

export async function changeStatusAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = statusChangeSchema.safeParse({
    status: formData.get('status'),
    reason: formData.get('reason') ?? '',
    newStartsLocal: formData.get('newStartsLocal') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const tz = String(formData.get('timezone') || 'America/Port_of_Spain');
  const supabase = await createClient();
  const id = String(formData.get('id'));
  const { error } = await supabase.rpc('change_event_status', {
    p_id: id,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
    p_new_starts_at: parsed.data.newStartsLocal ? zonedLocalToIso(parsed.data.newStartsLocal, tz) : null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(String(formData.get('back')));
  return { ok: parsed.data.status === 'published' ? 'The event is back on.' : `The event is now ${parsed.data.status}.` };
}

export async function duplicateEventAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const local = String(formData.get('newStartsLocal') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return { error: 'Choose the new date and time.' };
  const tz = String(formData.get('timezone') || 'America/Port_of_Spain');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('duplicate_event', { p_id: String(formData.get('id')), p_new_starts_at: zonedLocalToIso(local, tz) });
  if (error) return { error: friendlyError(error) };
  redirect(`${String(formData.get('back'))}/${data as string}?duplicated=1`);
}

export async function suggestRaceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = raceSuggestionSchema.safeParse({
    name: formData.get('name'),
    eventDate: formData.get('eventDate') ?? '',
    location: formData.get('location') ?? '',
    url: formData.get('url') ?? '',
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('suggest_race', {
    p_name: parsed.data.name,
    p_event_date: parsed.data.eventDate ?? null,
    p_location: parsed.data.location ?? null,
    p_url: parsed.data.url ?? null,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: friendlyError(error) };
  return { ok: 'Thanks! Our team will check it and add it to the calendar if we can confirm the details.' };
}
