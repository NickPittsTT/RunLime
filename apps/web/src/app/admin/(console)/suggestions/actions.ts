'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function dismissSuggestion(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc('review_race_suggestion', { p_id: String(formData.get('id')), p_status: 'dismissed' });
  revalidatePath('/admin/suggestions');
}
