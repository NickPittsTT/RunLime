import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Phone notifications (Expo Push → Firebase Cloud Messaging on Android). The in-app inbox works without this.
 * Android 13+: the system permission prompt is shown only after our explainer (never at app start).
 *
 * The phone's token is (re)registered whenever someone is signed in and permission is granted: at app start, after
 * sign-in or an account switch, and when the token changes. Sign-out removes it (owner retest 2026-10-18: tokens
 * were only registered from the explainer, so after a sign-out/in no phone notifications arrived).
 */
const askedKey = (uid: string) => `runlime.pushAsked.v1.${uid}`;

/** High importance so updates show as a banner. Android can't raise an existing channel's importance, hence a new id. */
export const PUSH_CHANNEL_ID = 'race-updates';

export type PushStatus = 'on' | 'off' | 'denied' | 'unavailable';

/** Show notifications that arrive while the app is open (background/killed ones are shown by Android itself). */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Must exist before any notification arrives: Android drops notifications for a channel the app never created. */
export async function ensurePushChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: 'Race updates',
      description: 'Race changes, reminders, organiser updates, followers and clubs',
      importance: Notifications.AndroidImportance.HIGH,
    });
  } catch {
    // Older Android or no notification support: nothing to set up.
  }
}

export async function pushStatus(): Promise<PushStatus> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'on';
    return p.canAskAgain === false ? 'denied' : 'off';
  } catch {
    return 'unavailable';
  }
}

/** Whether to show the explainer after a natural moment (first RSVP, follow or club request). Once per account. */
export async function shouldOfferPush(uid: string): Promise<boolean> {
  try {
    if ((await pushStatus()) !== 'off') return false;
    return (await AsyncStorage.getItem(askedKey(uid))) === null;
  } catch {
    return false;
  }
}

export async function markPushOffered(uid: string): Promise<void> {
  await AsyncStorage.setItem(askedKey(uid), new Date().toISOString()).catch(() => undefined);
}

const projectId = () => (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

async function thisPhoneToken(): Promise<string> {
  const id = projectId();
  return (await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : undefined)).data;
}

async function register(token: string): Promise<boolean> {
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
  return !error;
}

/**
 * If notifications are allowed, make sure this phone is registered to the signed-in account (idempotent). Never asks
 * for permission. Returns 'on' only when the token is stored.
 */
export async function syncPushRegistration(): Promise<PushStatus> {
  const status = await pushStatus();
  if (status !== 'on') return status;
  try {
    await ensurePushChannel();
    return (await register(await thisPhoneToken())) ? 'on' : 'unavailable';
  } catch {
    // e.g. a build without Firebase configuration.
    return 'unavailable';
  }
}

/** Ask the system (Android 13+ prompt), then register this phone's push token with the account. */
export async function enablePush(uid: string): Promise<PushStatus> {
  await markPushOffered(uid);
  try {
    await ensurePushChannel();
    let p = await Notifications.getPermissionsAsync();
    if (!p.granted && p.canAskAgain !== false) p = await Notifications.requestPermissionsAsync();
    if (!p.granted) return p.canAskAgain === false ? 'denied' : 'off';
    return (await register(await thisPhoneToken())) ? 'on' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Whether this phone is registered to the signed-in account (what Notification settings shows as "On"). */
export async function phoneRegistered(): Promise<boolean> {
  try {
    if ((await pushStatus()) !== 'on') return false;
    const { data, error } = await supabase.from('push_tokens').select('token').eq('token', await thisPhoneToken()).maybeSingle();
    return !error && data !== null;
  } catch {
    return false;
  }
}

/** Re-register when Android/Expo rotates this phone's token. Returns an unsubscribe function. */
export function watchPushToken(): () => void {
  const sub = Notifications.addPushTokenListener(() => {
    void syncPushRegistration();
  });
  return () => sub.remove();
}

/** Forget this phone's token (sign-out). */
export async function disablePushForThisPhone(): Promise<void> {
  try {
    await supabase.rpc('unregister_push_token', { p_token: await thisPhoneToken() });
  } catch {
    // No token on this phone: nothing to remove.
  }
}

export const openSystemSettings = () => void Linking.openSettings();
