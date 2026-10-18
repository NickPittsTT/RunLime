import { avatarUrl } from '@runlime/shared/community';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { config } from './config';
import { callFunction } from './edgeFunctions';

export const photoUrl = (path: string | null | undefined) => avatarUrl(config.supabaseUrl ?? '', path);

export type PhotoResult = { ok: true } | { ok: false; cancelled?: boolean; message?: string };

const MESSAGES: Record<string, string> = {
  too_large: 'That photo is too large. Try another one.',
  not_a_photo: 'That file is not a photo we can use. Try another one.',
  bad_size: 'That photo is too small. Choose one at least 64 × 64 pixels.',
  jpeg_only: 'That file is not a photo we can use. Try another one.',
};

/**
 * Pick a photo with the system photo picker (no media permission needed), crop it square, and re-encode it
 * as a 512 px JPEG on the phone (which drops location and other metadata). The server strips metadata again.
 */
export async function chooseAndUploadPhoto(): Promise<PhotoResult> {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1, exif: false });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return { ok: false, cancelled: true };
  const small = await manipulateAsync(asset.uri, [{ resize: { width: 512, height: 512 } }], { compress: 0.8, format: SaveFormat.JPEG });
  const body = await (await fetch(small.uri)).arrayBuffer();
  try {
    const res = await callFunction('profile-photo', { method: 'POST', body, headers: { 'content-type': 'image/jpeg' } });
    if (res.ok) return { ok: true };
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, message: MESSAGES[err.error ?? ''] ?? 'We could not save your photo. Please try again.' };
  } catch {
    return { ok: false, message: 'We could not save your photo. Check your connection and try again.' };
  }
}

export async function removePhoto(): Promise<boolean> {
  try {
    return (await callFunction('profile-photo', { method: 'DELETE' })).ok;
  } catch {
    return false;
  }
}
