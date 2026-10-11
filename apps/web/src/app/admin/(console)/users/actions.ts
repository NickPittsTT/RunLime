'use server';
import { revalidatePath } from 'next/cache';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export async function setPlatformAdmin(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get('userId'));
  const grant = formData.get('grant') === 'true';
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_platform_admin', { p_user: userId, p_grant: grant });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/admin/users');
  return { ok: grant ? 'Platform admin granted. They must set up two-factor authentication before using admin tools.' : 'Platform admin removed.' };
}
