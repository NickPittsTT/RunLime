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

/**
 * Sound + banner by default (owner retest B8: alerts arrived silently until "Pop on screen" and "Sound" were switched
 * on by hand). Android keeps a channel's settings once created, so each change needs a new id; old ones are removed.
 */
export const PUSH_CHANNEL_ID = 'race-alerts';
const OLD_CHANNEL_IDS = ['default', 'race-updates'];

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
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 250, 150, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });
    for (const id of OLD_CHANNEL_IDS) await Notifications.deleteNotificationChannelAsync(id).catch(() => undefined);
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

// The token this phone last registered, so sign-out can remove it without asking Expo again (owner retest B1:
// a failed unregister left a signed-out phone receiving the account's notifications). A failed removal is kept as
// pending and retried (signed in or not) until the server confirms.
const TOKEN_KEY = 'runlime.pushToken.v1';
const PENDING_KEY = 'runlime.pushUnregisterPending.v1';
const store = {
  get: (k: string) => AsyncStorage.getItem(k).catch(() => null),
  set: (k: string, v: string) => AsyncStorage.setItem(k, v).catch(() => undefined),
  del: (k: string) => AsyncStorage.removeItem(k).catch(() => undefined),
};

async function register(token: string): Promise<boolean> {
  // A removal still pending for this phone must reach the server before the phone is attached to anyone.
  await retryPendingUnregister();
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
  if (!error) await store.set(TOKEN_KEY, token);
  return !error;
}

async function unregister(token: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
    return !error;
  } catch {
    return false;
  }
}

/** Retry a removal that failed earlier (offline at sign-out, app closed mid-way). Safe to call any time. */
export async function retryPendingUnregister(): Promise<void> {
  const pending = await store.get(PENDING_KEY);
  if (pending && (await unregister(pending))) await store.del(PENDING_KEY);
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

/**
 * Sign-out / account deletion: detach this phone from the account on the server. Uses the stored token (no Expo
 * call); falls back to asking Expo only if none is stored. If the server can't be reached, the removal stays
 * pending and is retried. The server also stops pushing to a phone once its sign-in session ends.
 */
export async function disablePushForThisPhone(): Promise<void> {
  let token = await store.get(TOKEN_KEY);
  if (!token) {
    try {
      token = await thisPhoneToken();
    } catch {
      token = null; // No notifications on this phone: nothing to remove.
    }
  }
  if (!token) return;
  await store.del(TOKEN_KEY);
  if (!(await unregister(token))) await store.set(PENDING_KEY, token);
}

export const openSystemSettings = () => void Linking.openSettings();
