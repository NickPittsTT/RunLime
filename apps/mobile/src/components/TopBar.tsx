import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

/** N1: menu (left), title, notifications bell (right). */
export function TopBar({ title, onMenu, onBell, unread = 0 }: { title: string; onMenu: () => void; onBell: () => void; unread?: number }) {
  const { c, minTouchTarget } = useTheme();
  const insets = useSafeAreaInsets();
  const btn = { width: minTouchTarget, height: minTouchTarget, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.background, borderBottomWidth: 1, borderColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, minHeight: 56 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open menu" onPress={onMenu} style={btn}>
          <Ionicons name="menu" size={26} color={c.ink} />
        </Pressable>
        <T variant="title" style={{ flex: 1, textAlign: 'center' }}>
          {title}
        </T>
        <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'} onPress={onBell} style={btn}>
          <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={24} color={c.ink} />
          {unread ? (
            <View testID="bell-badge" style={{ position: 'absolute', top: 6, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <T style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{unread > 99 ? '99+' : unread}</T>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}
