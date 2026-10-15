import type { ExpoConfig } from 'expo/config';

/**
 * Bundle identifiers are DEVELOPMENT values until the owner confirms the RunLime name is available
 * on both stores, domains and trademark registers (Phase 8 fixes the store IDs).
 */
const APP_ENV = process.env.APP_ENV ?? 'development';
/** Existing Expo project (owner-created on expo.dev). Not a secret. */
const EAS_PROJECT_ID = 'ca1a5ee2-b15a-488d-b123-8fd075db8be1';
const bundleId = process.env.APP_BUNDLE_ID ?? 'tt.runlime.app.dev';
const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME; // reversed iOS client ID from Google Cloud

const config: ExpoConfig = {
  name: APP_ENV === 'production' ? 'RunLime' : `RunLime (${APP_ENV})`,
  slug: 'runlime',
  scheme: 'runlime',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: bundleId.replace(/-/g, '_'),
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#14532D' },
    // Phase 1 needs no dangerous permissions. Location/activity recognition are added in Phases 4–5 with disclosures.
    blockedPermissions: [
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      // The dev menu overlay needs this in development builds only.
      ...(APP_ENV === 'development' ? [] : ['android.permission.SYSTEM_ALERT_WINDOW']),
    ],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    // The splash plugin always references a logo drawable, so it must be given an image (EAS build 98d0e228).
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: '#14532D', resizeMode: 'contain' }],
    ...(googleIosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }] as [string, unknown]] : []),
  ],
  experiments: { typedRoutes: true },
  extra: {
    appEnv: APP_ENV,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000',
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    eas: { projectId: EAS_PROJECT_ID },
  },
};

export default config;
