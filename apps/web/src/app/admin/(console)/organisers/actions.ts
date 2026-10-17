'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export async function reviewOrganisation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get('id'));
  const decision = String(formData.get('decision'));
  const reason = String(formData.get('reason') ?? '');
  if (!['verified', 'rejected', 'suspended'].includes(decision)) return { error: 'Choose a decision.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('review_organisation', { p_org: id, p_decision: decision, p_reason: reason || null });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/admin/organisers');
  return { ok: `Organisation ${decision}.` };
}

/** Admin creates a verified organisation directly (audited in the database). */
export async function createOrganisation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const text = (k: string) => String(formData.get(k) ?? '').trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_create_organisation', {
    p_name: text('name'),
    p_contact_email: text('contact_email'),
    p_contact_phone: text('contact_phone'),
    p_website: text('website'),
    p_about: text('about'),
    p_is_charity: formData.get('is_charity') === 'on',
    p_owner_email: text('owner_email') || null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/admin/organisers');
  redirect('/admin/organisers?status=verified&created=1');
}
