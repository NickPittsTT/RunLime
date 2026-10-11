'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function deleteMyAccount(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  if (formData.get('confirm') !== 'DELETE') return { error: 'Type DELETE to confirm.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    return { error: /super admin/i.test(error.message) ? 'The super admin account cannot be deleted here.' : 'We could not delete your account. Please try again or contact support.' };
  }
  await supabase.auth.signOut();
  redirect('/delete-account?deleted=1');
}
