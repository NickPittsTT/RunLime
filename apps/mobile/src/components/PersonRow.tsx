import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { Person } from '@/lib/social';
import { useTheme } from '@/lib/theme';
import { Avatar } from './Avatar';
import { T } from './ui';

/** One person in a list: photo, name, nickname; tap opens their profile; optional actions on the right. */
export function PersonRow({ person, onPress, actions }: { person: Person; onPress: () => void; actions?: ReactNode }) {
  const { c, spacing, minTouchTarget } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: minTouchTarget + 8, borderBottomWidth: 1, borderColor: c.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${person.display_name}${person.nickname ? `, ${person.nickname}` : ''}. Open profile`}
        onPress={onPress}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 }}
      >
        <Avatar name={person.display_name} path={person.avatar_path} size={44} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '700' }} numberOfLines={1}>
            {person.display_name}
          </T>
          {person.nickname ? (
            <T variant="caption" numberOfLines={1}>
              {person.nickname}
            </T>
          ) : null}
        </View>
      </Pressable>
      {actions ? <View style={{ flexDirection: 'row', gap: spacing.sm }}>{actions}</View> : null}
    </View>
  );
}
