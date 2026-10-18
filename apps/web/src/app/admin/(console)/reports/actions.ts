'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { callFunction } from '@/lib/functions';
import { createClient } from '@/lib/supabase/server';

/** Removes the reported person's photo (profile + file) and closes their open photo reports. Audit-logged. */
export async function removePhotoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const res = await callFunction(supabase, 'profile-photo', {
    method: 'POST',
    body: JSON.stringify({ action: 'admin_remove', userId: String(formData.get('userId')), reportId: String(formData.get('reportId')), note: String(formData.get('note') ?? '') }),
  }).catch(() => null);
  if (!res?.ok) return { error: res?.status === 403 ? 'You do not have permission to do that. Confirm your authenticator code and try again.' : 'The photo could not be removed. Please try again.' };
  revalidatePath('/admin/reports');
  redirect('/admin/reports?done=photo');
}

export async function resolveReportAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const status = String(formData.get('status'));
  const { error } = await supabase.rpc('admin_resolve_report', { p_report: String(formData.get('reportId')), p_status: status, p_note: String(formData.get('note') ?? '') });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/admin/reports');
  redirect(`/admin/reports?done=${status === 'dismissed' ? 'dismissed' : 'actioned'}`);
}
