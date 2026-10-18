import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

/** − value + with large touch targets; announced as an adjustable control. */
export function Stepper({ label, hint, value, min, max, onChange, unit }: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void; unit: [string, string] }) {
  const { c, minTouchTarget, radius } = useTheme();
  const words = `${value} ${value === 1 ? unit[0] : unit[1]}`;
  const btn = (dir: -1 | 1) => {
    const disabled = dir < 0 ? value <= min : value >= max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${dir < 0 ? 'Fewer' : 'More'} ${unit[1]}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(value + dir)}
        style={{ width: minTouchTarget, height: minTouchTarget, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
      >
        <Ionicons name={dir < 0 ? 'remove' : 'add'} size={22} color={c.ink} />
      </Pressable>
    );
  };
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '700' }}>{label}</T>
          {hint ? <T variant="caption">{hint}</T> : null}
        </View>
        {btn(-1)}
        <T accessibilityLabel={`${label}: ${words}`} accessibilityLiveRegion="polite" style={{ minWidth: 28, textAlign: 'center', fontSize: 20, fontWeight: '800' }}>
          {value}
        </T>
        {btn(1)}
      </View>
    </View>
  );
}
