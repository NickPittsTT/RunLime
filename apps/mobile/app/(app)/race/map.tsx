import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RaceMap } from '@/components/RaceMap';
import { T } from '@/components/ui';
import { useRace } from '@/lib/raceDetail';
import { useTheme } from '@/lib/theme';

/** M17: full-screen start pin + route. */
export default function RaceMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { race: e, state } = useRace(id);
  const { c, spacing } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: e ? e.name : 'Map' }} />
      {e ? (
        <View style={{ flex: 1, padding: spacing.sm }}>
          <RaceMap label={`Map of ${e.name}`} pins={[{ id: e.id, lat: e.start_lat, lng: e.start_lng, label: `Start: ${e.venue_name}` }]} route={e.route} />
          {!e.route ? (
            <T variant="caption" style={{ padding: spacing.sm }}>
              The organiser has not added a route. The pin shows the start.
            </T>
          ) : null}
        </View>
      ) : (
        <T variant="muted" style={{ padding: spacing.lg }}>
          {state === 'loading' ? 'Loading map…' : 'Could not load this race.'}
        </T>
      )}
    </SafeAreaView>
  );
}
