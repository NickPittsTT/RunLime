import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Area } from '@/lib/regions';
import { DISTANCE_CHOICES } from '@/lib/preferences';
import { useTheme } from '@/lib/theme';
import { Button, Chip, T } from './ui';

export interface RaceFilters {
  regionIds: string[];
  distanceKm: number[];
  freeOnly: boolean;
  cause: boolean;
  walkFriendly: boolean;
}

export const NO_FILTERS: RaceFilters = { regionIds: [], distanceKm: [], freeOnly: false, cause: false, walkFriendly: false };

export function activeFilterCount(f: RaceFilters): number {
  return f.regionIds.length + f.distanceKm.length + Number(f.freeOnly) + Number(f.cause) + Number(f.walkFriendly);
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** M14: race filters (area, distance, price, cause, walk-friendly). */
export function FilterSheet({
  open,
  value,
  areas,
  onChange,
  onClose,
}: {
  open: boolean;
  value: RaceFilters;
  areas: Area[] | null;
  onChange: (f: RaceFilters) => void;
  onClose: () => void;
}) {
  const { c, spacing } = useTheme();
  const row = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm };
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <T variant="headline">Filters</T>
          <T variant="title">Area</T>
          <View style={row}>
            {(areas ?? []).map((a) => (
              <Chip key={a.id} label={a.name} selected={value.regionIds.includes(a.id)} onPress={() => onChange({ ...value, regionIds: toggle(value.regionIds, a.id) })} />
            ))}
          </View>
          <T variant="title">Distance</T>
          <View style={row}>
            {DISTANCE_CHOICES.map((d) => (
              <Chip key={d.km} label={d.label} selected={value.distanceKm.includes(d.km)} onPress={() => onChange({ ...value, distanceKm: toggle(value.distanceKm, d.km) })} />
            ))}
          </View>
          <T variant="title">More</T>
          <View style={row}>
            <Chip label="Free entry" selected={value.freeOnly} onPress={() => onChange({ ...value, freeOnly: !value.freeOnly })} />
            <Chip label="For a cause" selected={value.cause} onPress={() => onChange({ ...value, cause: !value.cause })} />
            <Chip label="Walkers welcome" selected={value.walkFriendly} onPress={() => onChange({ ...value, walkFriendly: !value.walkFriendly })} />
          </View>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderTopWidth: 1, borderColor: c.border }}>
          <View style={{ flex: 1 }}>
            <Button label="Clear all" variant="secondary" onPress={() => onChange(NO_FILTERS)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Show races" onPress={onClose} />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
