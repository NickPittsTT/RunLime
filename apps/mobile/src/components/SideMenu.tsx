import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@runlime/ui-tokens';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

export interface MenuItem {
  key: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  /** Undefined = not built yet ("Coming soon", not tappable). */
  onPress?: () => void;
  danger?: boolean;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

/** N2: side menu. Header (avatar, name, nickname, quick stat) opens the full profile. */
export function SideMenu({
  open,
  onClose,
  name,
  nickname,
  stat,
  onProfile,
  items,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  nickname: string | null;
  stat: string;
  onProfile: () => void;
  items: MenuItem[];
}) {
  const { c, minTouchTarget, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View
          accessibilityViewIsModal
          style={{ width: '82%', maxWidth: 360, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${name}${nickname ? `, ${nickname}` : ''}. ${stat}. Open profile`}
            onPress={onProfile}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: c.surface, borderBottomWidth: 1, borderColor: c.border }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ color: colors.ink, fontWeight: '800', fontSize: 20 }}>{initials(name)}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '800' }} numberOfLines={1}>
                {name}
              </T>
              {nickname ? (
                <T variant="muted" numberOfLines={1}>
                  {nickname}
                </T>
              ) : null}
              <T variant="caption">{stat}</T>
            </View>
          </Pressable>
          <ScrollView>
            {items.map((it) => (
              <Pressable
                key={it.key}
                accessibilityRole="button"
                accessibilityLabel={it.onPress ? it.label : `${it.label}, coming soon`}
                accessibilityState={{ disabled: !it.onPress }}
                disabled={!it.onPress}
                onPress={() => {
                  onClose();
                  it.onPress?.();
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  minHeight: minTouchTarget + 4,
                  paddingHorizontal: spacing.lg,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name={it.icon} size={22} color={it.danger ? c.danger : it.onPress ? c.ink : c.inkMuted} />
                <T style={{ flex: 1, color: it.danger ? c.danger : it.onPress ? c.ink : c.inkMuted, fontWeight: '600' }}>{it.label}</T>
                {!it.onPress ? <T variant="caption">Coming soon</T> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      </View>
    </Modal>
  );
}
