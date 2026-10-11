'use server';
import { organiserApplicationSchema } from '@runlime/shared/schemas';
import { revalidatePath } from 'next/cache';
import { friendlyError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export interface ApplyState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function applyAsOrganiser(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const parsed = organiserApplicationSchema.safeParse({
    organisationName: formData.get('organisationName'),
    contactEmail: formData.get('contactEmail'),
    contactPhone: formData.get('contactPhone'),
    website: formData.get('website') ?? '',
    about: formData.get('about'),
    isCharity: formData.get('isCharity') === 'on',
  });
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('apply_as_organiser', {
    p_name: parsed.data.organisationName,
    p_contact_email: parsed.data.contactEmail,
    p_contact_phone: parsed.data.contactPhone,
    p_website: parsed.data.website ?? '',
    p_about: parsed.data.about,
    p_is_charity: parsed.data.isCharity,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/organiser');
  return {};
}
