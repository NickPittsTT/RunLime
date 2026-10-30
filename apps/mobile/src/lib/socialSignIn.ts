import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { config } from './config';
import { loadGoogleSignin } from './googleSigninModule';
import { supabase } from './supabase';

export const googleConfigured = Boolean(config.googleWebClientId);

/** Apple: native sheet → ID token with a hashed nonce → Supabase session. iOS only. */
export async function signInWithApple(): Promise<'ok' | 'cancelled'> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error('No identity token from Apple');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
    if (error) throw error;
    return 'ok';
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
    throw e;
  }
}

export async function appleAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

/** Never blocks for long: a stuck Google call must not hold up sign-in or sign-out. */
const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);

/**
 * Forget the Google account the library remembers, so the next "Continue with Google" shows the account chooser
 * (owner retest B6: with several Google accounts it silently reused the last one). Used on sign-in, sign-out and
 * account deletion; failures are ignored.
 */
export async function forgetGoogleAccount(): Promise<void> {
  try {
    const { GoogleSignin } = await loadGoogleSignin();
    GoogleSignin.configure({ webClientId: config.googleWebClientId, iosClientId: config.googleIosClientId });
    await withTimeout(GoogleSignin.signOut(), 3000);
  } catch {
    // Not signed in with Google, or no Google services: nothing to forget.
  }
}

/** Google: native account picker → ID token → Supabase session. Requires a development/production build. */
export async function signInWithGoogle(): Promise<'ok' | 'cancelled'> {
  const { GoogleSignin, isErrorWithCode, statusCodes } = await loadGoogleSignin();
  GoogleSignin.configure({ webClientId: config.googleWebClientId, iosClientId: config.googleIosClientId });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Always offer the account chooser rather than reusing the last Google account.
    await forgetGoogleAccount();
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return 'cancelled';
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('No ID token from Google');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
    return 'ok';
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return 'cancelled';
    throw e;
  }
}
