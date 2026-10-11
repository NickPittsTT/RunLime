import * as WebBrowser from 'expo-web-browser';
import { config } from './config';

export const LEGAL_PAGES = [
  { label: 'Privacy Policy', path: '/legal/privacy' },
  { label: 'Terms of Use', path: '/legal/terms' },
  { label: 'Health Disclaimer', path: '/legal/health' },
  { label: 'Moderation Policy', path: '/legal/moderation' },
  { label: 'Child Safety Policy', path: '/legal/child-safety' },
  { label: 'Community Times', path: '/legal/community-times' },
  { label: 'Help & support', path: '/support' },
] as const;

export function openWebPage(path: string) {
  return WebBrowser.openBrowserAsync(`${config.webUrl}${path}`);
}
