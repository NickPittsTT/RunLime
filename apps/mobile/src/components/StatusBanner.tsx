import { STATUS_LABEL } from '@runlime/shared/events';
import { View } from 'react-native';
import { T } from './ui';

/** Fixed light colours so the banner reads the same in light and dark mode (text contrast ≥ 7:1). */
const TONE: Record<string, { bg: string; fg: string; border: string }> = {
  cancelled: { bg: '#FEE2E2', fg: '#7F1D1D', border: '#B91C1C' },
  postponed: { bg: '#FEF3C7', fg: '#78350F', border: '#B45309' },
};

/** Clear status strip for postponed / cancelled races (list cards and the race page). Renders nothing when scheduled. */
export function StatusBanner({ status, reason, compact }: { status: string; reason?: string | null; compact?: boolean }) {
  const tone = TONE[status];
  if (!tone) return null;
  const label = STATUS_LABEL[status] ?? status;
  return (
    <View
      testID={`status-banner-${status}`}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${label}.${reason ? ` ${reason}` : ''}`}
      style={{ backgroundColor: tone.bg, borderLeftWidth: 5, borderColor: tone.border, paddingHorizontal: 12, paddingVertical: compact ? 6 : 10, borderRadius: 6 }}
    >
      <T style={{ color: tone.fg, fontWeight: '900', letterSpacing: 0.5 }}>{label.toUpperCase()}</T>
      {reason ? (
        <T style={{ color: tone.fg }} numberOfLines={compact ? 2 : undefined}>
          {reason}
        </T>
      ) : null}
    </View>
  );
}
