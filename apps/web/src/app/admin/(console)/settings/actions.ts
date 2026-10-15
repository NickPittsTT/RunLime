'use server';
import { revalidatePath } from 'next/cache';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

/** Update one setting, keeping its JSON type (string / number / boolean). Audited by the database. */
export async function saveSetting(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const key = String(formData.get('key'));
  const kind = String(formData.get('kind'));
  const raw = String(formData.get('value') ?? '');
  let value: unknown;
  if (kind === 'number') {
    value = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(value)) return { error: 'Enter a number.' };
  } else if (kind === 'boolean') {
    value = raw === 'true';
  } else if (kind === 'string') {
    if (raw.length > 5000) return { error: 'Too long (5,000 characters max).' };
    value = raw.trim() === '' ? null : raw.trim();
  } else {
    try {
      value = JSON.parse(raw);
    } catch {
      return { error: 'Enter valid JSON.' };
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.from('app_settings').update({ value }).eq('key', key);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/admin/settings');
  return { ok: 'Saved.' };
}
