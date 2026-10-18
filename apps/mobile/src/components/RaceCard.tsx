import { feeLabel, formatEventDate, formatEventTime, haversineKm, postponementInfo, type CalendarEvent } from '@runlime/shared/events';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { StatusBanner } from './StatusBanner';
import { T } from './ui';

export function RaceCard({ event: e, onPress, near, going, badge }: { event: CalendarEvent; onPress: () => void; near?: { lat: number; lng: number } | null; going?: string | null; badge?: string }) {
  const { c, radius, spacing } = useTheme();
  const distances = e.distances.map((d) => d.label).join(' · ');
  const postponed = postponementInfo(e);
  const away = near ? haversineKm(near, { lat: e.start_lat, lng: e.start_lng }) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[e.name, e.status === 'postponed' ? 'Postponed' : e.status === 'cancelled' ? 'Cancelled' : null, postponed?.headline, postponed?.hasNewDate ? `originally ${postponed.originalDate}` : null, e.status_reason, formatEventDate(e.starts_at, e.timezone), formatEventTime(e.starts_at, e.timezone), e.venue_name, distances, feeLabel(e), going, badge]
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
      <StatusBanner status={e.status} reason={e.status_reason} postponement={postponed} compact />
      {badge ? (
        <T testID="race-card-badge" style={{ alignSelf: 'flex-start', color: c.leaf, fontWeight: '800' }}>
          {badge}
        </T>
      ) : null}
      <T style={{ fontWeight: '800', fontSize: 17, textDecorationLine: e.status === 'cancelled' ? 'line-through' : 'none' }}>{e.name}</T>
      {/* Postponed with no new date yet: the listed date no longer holds. */}
      <T variant="muted" style={{ textDecorationLine: postponed && !postponed.hasNewDate ? 'line-through' : 'none' }}>
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
        {going ? <T variant="caption" style={{ fontWeight: '700' }}>· {going}</T> : null}
      </View>
    </Pressable>
  );
}
