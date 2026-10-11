import 'server-only';
import { legalValuesFromSettings } from '@runlime/shared/legal';
import { createClient } from './supabase/server';

export async function getPublicSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('app_settings').select('key, value');
  if (error) throw error;
  return data ?? [];
}

export async function getLegalValues() {
  return legalValuesFromSettings(await getPublicSettings());
}
