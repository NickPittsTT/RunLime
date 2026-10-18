import { RUNNER_LEVELS, RUNNER_LEVEL_NOTE, type RunnerLevel } from '@runlime/shared/community';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SectionHeader } from '@/components/FilterSheet';
import { Button, Chip, Screen, T } from '@/components/ui';
import { DISTANCE_CHOICES, loadPreferences, savePreferences } from '@/lib/preferences';
import { useAreas } from '@/lib/regions';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useSession } from '@/state/session';

const SLIDES = [
  { title: 'Every race in one calendar', body: 'Find 5Ks and fun runs across Trinidad and Tobago. Swipe through the months and tap a day to see its races.' },
  { title: 'Register with the organiser', body: 'RunLime does not take entries or fees. Each race links to the organiser\'s official page.' },
  { title: 'Track your runs (coming soon)', body: 'Run tracking, check-ins and your race passport arrive in later updates. Your runs stay private unless you share them.' },
];

/**
 * M8 walkthrough + M9 areas and distances + M9a runner level (optional). Areas and distances are saved to the
 * account and used as the starting filters. With ?edit=1 (Profile → Your areas and distances) only that step shows.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const { areas } = useAreas();
  const { profile, refreshProfile } = useSession();
  const editing = useLocalSearchParams<{ edit?: string }>().edit === '1';
  const [step, setStep] = useState(editing ? SLIDES.length : 0);
  const [regionIds, setRegionIds] = useState<string[]>([]);
  const [distanceKm, setDistanceKm] = useState<number[]>([]);
  const [level, setLevel] = useState<RunnerLevel | null>(profile?.runner_level ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) return;
    void loadPreferences().then((p) => {
      setRegionIds(p.regionIds);
      setDistanceKm(p.distanceKm);
    });
  }, [editing]);

  const finish = async (save: boolean) => {
    setBusy(true);
    await savePreferences({ onboarded: true, regionIds: save ? regionIds : [], distanceKm: save ? distanceKm : [] }).catch(() => undefined);
    if (save && !editing && level && profile) {
      await supabase.from('profiles').update({ runner_level: level }).eq('id', profile.id);
      await refreshProfile();
    }
    setBusy(false);
    if (editing) router.back();
    else router.replace('/');
  };

  const slide = SLIDES[step];
  return (
    <Screen>
      <Stack.Screen options={editing ? { title: 'Your areas and distances' } : { title: 'Welcome', headerBackVisible: false, gestureEnabled: false }} />
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
          {editing ? null : (
            <T variant="caption">
              {SLIDES.length + 1} of {SLIDES.length + 1}
            </T>
          )}
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
          {editing ? null : (
            <>
              <T variant="title">Your runner level (optional)</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {RUNNER_LEVELS.map((l) => (
                  <Chip key={l.value} label={l.label} accessibilityHint={l.help} selected={level === l.value} onPress={() => setLevel(level === l.value ? null : l.value)} />
                ))}
              </View>
              <T variant="caption">{RUNNER_LEVEL_NOTE}</T>
            </>
          )}
          <Button label={editing ? 'Save' : 'Show races'} onPress={() => void finish(true)} busy={busy} />
          <Button label={editing ? 'Cancel' : 'Back'} variant="secondary" onPress={() => (editing ? router.back() : setStep(step - 1))} />
        </>
      )}
    </Screen>
  );
}
