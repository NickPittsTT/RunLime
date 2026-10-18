import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Phone notifications (Expo Push → Firebase Cloud Messaging on Android). The in-app inbox works without this.
 * Android 13+: the system permission prompt is shown only after our explainer (never at app start).
 */
const askedKey = (uid: string) => `runlime.pushAsked.v1.${uid}`;

export type PushStatus = 'on' | 'off' | 'denied' | 'unavailable';

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

/** Ask the system (Android 13+ prompt), then register this phone's push token with the account. */
export async function enablePush(uid: string): Promise<PushStatus> {
  await markPushOffered(uid);
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'RunLime', importance: Notifications.AndroidImportance.DEFAULT });
    }
    let p = await Notifications.getPermissionsAsync();
    if (!p.granted && p.canAskAgain !== false) p = await Notifications.requestPermissionsAsync();
    if (!p.granted) return p.canAskAgain === false ? 'denied' : 'off';
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    return error ? 'unavailable' : 'on';
  } catch {
    // e.g. this build has no Firebase configuration yet.
    return 'unavailable';
  }
}

/** Forget this phone's token (sign-out). */
export async function disablePushForThisPhone(): Promise<void> {
  try {
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await supabase.rpc('unregister_push_token', { p_token: token });
  } catch {
    // No token on this phone: nothing to remove.
  }
}

export const openSystemSettings = () => void Linking.openSettings();
