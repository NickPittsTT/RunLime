'use server';
import { revalidatePath } from 'next/cache';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export async function updateOrganisation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const org = String(formData.get('org'));
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_organisation', {
    p_org: org,
    p_contact_email: String(formData.get('contactEmail') ?? ''),
    p_contact_phone: String(formData.get('contactPhone') ?? ''),
    p_website: String(formData.get('website') ?? ''),
    p_about: String(formData.get('about') ?? ''),
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/organiser/settings/${org}`);
  return { ok: 'Saved.' };
}

export async function addMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const org = String(formData.get('org'));
  const email = String(formData.get('email') ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('add_organisation_member', { p_org: org, p_email: email, p_role: String(formData.get('role') ?? 'manager') });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/organiser/settings/${org}`);
  return { ok: 'Added. They can now manage this organisation’s events.' };
}

export async function removeMember(formData: FormData) {
  const org = String(formData.get('org'));
  const supabase = await createClient();
  await supabase.rpc('remove_organisation_member', { p_org: org, p_user: String(formData.get('user')) });
  revalidatePath(`/organiser/settings/${org}`);
}
