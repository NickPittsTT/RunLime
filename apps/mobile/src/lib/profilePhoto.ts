import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { callFunction } from './edgeFunctions';
import { supabase } from './supabase';

/**
 * Photos are private (owner decision 4, 2026-10-31): the app shows them through short-lived signed links. Storage
 * signs a link only for someone allowed to see that photo (the person, approved followers, everyone signed in for a
 * Public account, MFA admins), so a path the server hands out never works for anyone else. Links requested in the
 * same moment go in one call; a link is reused for a few minutes; refusals and failures are never remembered, so a
 * newly allowed photo (e.g. an account just switched to Public) shows on the next screen load.
 */
const SIGNED_SECONDS = 600;
const REUSE_MS = 8 * 60_000;
const cache = new Map<string, { url: string; at: number }>();
let pending: Map<string, ((url: string | null) => void)[]> | null = null;

async function flush() {
  const batch = pending;
  pending = null;
  if (!batch) return;
  const urls = new Map<string, string>();
  try {
    const { data } = await supabase.storage.from('avatars').createSignedUrls([...batch.keys()], SIGNED_SECONDS);
    for (const d of data ?? []) if (d.path && d.signedUrl && !d.error) urls.set(d.path, d.signedUrl);
  } catch {
    // offline: initials for now
  }
  for (const [path, waiting] of batch) {
    const url = urls.get(path) ?? null;
    if (url) cache.set(path, { url, at: Date.now() });
    for (const done of waiting) done(url);
  }
}

export function cachedPhotoUrl(path: string | null | undefined): string | null {
  const hit = path ? cache.get(path) : undefined;
  return hit && Date.now() - hit.at < REUSE_MS ? hit.url : null;
}

export function signedPhotoUrl(path: string): Promise<string | null> {
  const hit = cachedPhotoUrl(path);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    if (!pending) {
      pending = new Map();
      setTimeout(() => void flush(), 0);
    }
    pending.set(path, [...(pending.get(path) ?? []), resolve]);
  });
}

/** Signed links belong to the account that asked for them: forget them on sign-out or account switch. */
export function forgetPhotoUrls() {
  cache.clear();
}

/** The photo's signed link, or null (show initials) while loading, when not allowed, or with no photo. */
export function usePhotoUri(path: string | null | undefined): string | null {
  const [state, setState] = useState<{ path: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    void signedPhotoUrl(path).then((url) => {
      if (active) setState({ path, url });
    });
    return () => {
      active = false;
    };
  }, [path]);
  if (!path) return null;
  return state?.path === path ? state.url : cachedPhotoUrl(path);
}

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
