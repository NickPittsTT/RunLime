import Constants from 'expo-constants';

interface Extra {
  appEnv: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  webUrl: string;
  googleWebClientId?: string;
  googleIosClientId?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  appEnv: extra.appEnv ?? 'development',
  supabaseUrl: extra.supabaseUrl ?? '',
  supabaseAnonKey: extra.supabaseAnonKey ?? '',
  webUrl: extra.webUrl,
  googleWebClientId: extra.googleWebClientId,
  googleIosClientId: extra.googleIosClientId,
};

export const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
