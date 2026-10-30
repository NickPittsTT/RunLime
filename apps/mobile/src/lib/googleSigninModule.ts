/** Loaded on first use only (the native module is absent in some dev environments). Separate so tests can mock it. */
export const loadGoogleSignin = () => import('@react-native-google-signin/google-signin');
