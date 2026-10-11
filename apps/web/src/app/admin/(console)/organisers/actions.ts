'use server';
import { revalidatePath } from 'next/cache';
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
