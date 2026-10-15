import { STATUS_LABEL, feeLabel, formatEventDate, formatEventTime, haversineKm, type CalendarEvent } from '@runlime/shared/events';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

export function RaceCard({ event: e, onPress, near }: { event: CalendarEvent; onPress: () => void; near?: { lat: number; lng: number } | null }) {
  const { c, radius, spacing } = useTheme();
  const distances = e.distances.map((d) => d.label).join(' · ');
  const away = near ? haversineKm(near, { lat: e.start_lat, lng: e.start_lng }) : null;
  const status = e.status !== 'published' ? STATUS_LABEL[e.status] : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[e.name, status, formatEventDate(e.starts_at, e.timezone), formatEventTime(e.starts_at, e.timezone), e.venue_name, distances, feeLabel(e)]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: 4,
        backgroundColor: c.background,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {status ? <T style={{ color: e.status === 'cancelled' ? c.danger : c.warning, fontWeight: '800' }}>{status}</T> : null}
      <T style={{ fontWeight: '800', fontSize: 17, textDecorationLine: e.status === 'cancelled' ? 'line-through' : 'none' }}>{e.name}</T>
      <T variant="muted">
        {formatEventDate(e.starts_at, e.timezone)} · {formatEventTime(e.starts_at, e.timezone)}
      </T>
      <T variant="muted" numberOfLines={1}>
        {e.venue_name}
        {away !== null ? ` · ${away < 10 ? away.toFixed(1) : Math.round(away)} km away` : ''}
      </T>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <T variant="caption">{distances}</T>
        <T variant="caption">· {feeLabel(e)}</T>
        {e.walk_friendly ? <T variant="caption">· Walkers welcome</T> : null}
        {e.cause ? <T variant="caption">· {e.cause}</T> : null}
      </View>
    </Pressable>
  );
}
