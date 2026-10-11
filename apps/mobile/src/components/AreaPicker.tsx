import { Pressable, View } from 'react-native';
import type { Area } from '@/lib/regions';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

/** Accessible single-choice list (radio group) for the home area. */
export function AreaPicker({ areas, value, onChange, error }: { areas: Area[]; value: string | null; onChange: (id: string) => void; error?: string }) {
  const { c, radius, minTouchTarget } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Home area" style={{ gap: 8 }}>
      <T style={{ fontWeight: '700' }}>Home area</T>
      {areas.map((a) => {
        const selected = a.id === value;
        return (
          <Pressable
            key={a.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(a.id)}
            style={{
              minHeight: minTouchTarget,
              justifyContent: 'center',
              paddingHorizontal: 14,
              borderRadius: radius.md,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? c.leaf : c.border,
              backgroundColor: selected ? c.surface : c.background,
            }}
          >
            <T style={{ fontWeight: selected ? '700' : '400' }}>{a.name}</T>
          </Pressable>
        );
      })}
      {error ? <T style={{ color: c.danger }}>{error}</T> : null}
    </View>
  );
}
