import { colors } from '@runlime/ui-tokens';
import { Image, View } from 'react-native';
import { photoUrl } from '@/lib/profilePhoto';
import { T } from './ui';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

/** Profile photo, or initials in a lime circle when there is none. */
export function Avatar({ name, path, size = 56 }: { name: string; path?: string | null; size?: number }) {
  const uri = photoUrl(path);
  if (uri) {
    return (
      <Image
        testID="avatar-photo"
        source={{ uri }}
        accessibilityIgnoresInvertColors
        accessibilityLabel={`Profile photo of ${name}`}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.lime }}
      />
    );
  }
  return (
    <View testID="avatar-initials" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ color: colors.ink, fontWeight: '800', fontSize: size * 0.36 }}>{initials(name)}</T>
    </View>
  );
}
