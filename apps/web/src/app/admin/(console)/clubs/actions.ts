'use server';
import { clubSchema } from '@runlime/shared/schemas';
import { revalidatePath } from 'next/cache';
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
