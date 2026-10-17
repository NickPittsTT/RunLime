import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SectionHeader } from '@/components/FilterSheet';
import { Button, Chip, Screen, T } from '@/components/ui';
import { DISTANCE_CHOICES, savePreferences } from '@/lib/preferences';
import { useAreas } from '@/lib/regions';
import { useTheme } from '@/lib/theme';

const SLIDES = [
  { title: 'Every race in one calendar', body: 'Find 5Ks and fun runs across Trinidad and Tobago. Swipe through the months and tap a day to see its races.' },
  { title: 'Register with the organiser', body: 'RunLime does not take entries or fees. Each race links to the organiser\'s official page.' },
  { title: 'Track your runs (coming soon)', body: 'Run tracking, check-ins and your race passport arrive in later updates. Your runs stay private unless you share them.' },
];

/** M8 walkthrough + M9 areas and distances (stored on this device; used as default filters). */
export default function OnboardingScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const { areas } = useAreas();
  const [step, setStep] = useState(0);
  const [regionIds, setRegionIds] = useState<string[]>([]);
  const [distanceKm, setDistanceKm] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const finish = async (save: boolean) => {
    setBusy(true);
    await savePreferences({ onboarded: true, regionIds: save ? regionIds : [], distanceKm: save ? distanceKm : [] }).catch(() => undefined);
    setBusy(false);
    router.replace('/');
  };

  const slide = SLIDES[step];
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Welcome', headerBackVisible: false, gestureEnabled: false }} />
      {slide ? (
        <>
          <T variant="caption">
            {step + 1} of {SLIDES.length + 1}
          </T>
          <T variant="headline">{slide.title}</T>
          <T>{slide.body}</T>
          <Button label="Next" onPress={() => setStep(step + 1)} />
          <Button label="Skip" variant="secondary" onPress={() => void finish(false)} busy={busy} />
        </>
      ) : (
        <>
          <T variant="caption">
            {SLIDES.length + 1} of {SLIDES.length + 1}
          </T>
          <T variant="headline">What races do you want to see?</T>
          <T variant="muted">Optional. Saved to your account as your starting filters. Change them any time with Filters.</T>
          <SectionHeader title="Areas" onAll={() => setRegionIds((areas ?? []).map((a) => a.id))} onNone={() => setRegionIds([])} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(areas ?? []).map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                selected={regionIds.includes(a.id)}
                onPress={() => setRegionIds(regionIds.includes(a.id) ? regionIds.filter((x) => x !== a.id) : [...regionIds, a.id])}
              />
            ))}
          </View>
          <SectionHeader title="Distances" onAll={() => setDistanceKm(DISTANCE_CHOICES.map((d) => d.km))} onNone={() => setDistanceKm([])} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {DISTANCE_CHOICES.map((d) => (
              <Chip
                key={d.km}
                label={d.label}
                selected={distanceKm.includes(d.km)}
                onPress={() => setDistanceKm(distanceKm.includes(d.km) ? distanceKm.filter((x) => x !== d.km) : [...distanceKm, d.km])}
              />
            ))}
          </View>
          <Button label="Show races" onPress={() => void finish(true)} busy={busy} />
          <Button label="Back" variant="secondary" onPress={() => setStep(step - 1)} />
        </>
      )}
    </Screen>
  );
}
