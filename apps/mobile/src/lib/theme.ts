import { colors, darkColors, fontSize, minTouchTarget, radius, spacing } from '@runlime/ui-tokens';
import { useColorScheme } from 'react-native';

export function useTheme() {
  const scheme = useColorScheme();
  return { c: scheme === 'dark' ? darkColors : colors, fontSize, spacing, radius, minTouchTarget };
}
