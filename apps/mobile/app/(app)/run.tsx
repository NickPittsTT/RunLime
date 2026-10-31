import { decodePolyline, formatDuration, formatPace } from '@runlime/shared/runs';
import { Stack, useRouter } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { RaceMap } from '@/components/RaceMap';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { useEntitlement } from '@/lib/entitlements';
import { getAutoPause, getWeightKg, markStepsPermissionAsked, setAutoPausePref, setWeightKg, stepsPermissionAsked } from '@/lib/runPrefs';
import { syncRuns } from '@/lib/runSync';
import { activeRun, discardActiveRun, keepFinishedRun, liveSummary, pauseRun, resumeRun, setAutoPause, startRun, stopRun } from '@/lib/tracker';
import type { LocalRun } from '@/lib/runDb';
import { useTheme } from '@/lib/theme';

type Live = NonNullable<ReturnType<typeof liveSummary>>;

/** M20–M22: Start run → live run (screen can lock) → summary (save or discard). */
export default function RunScreen() {
  const router = useRouter();
  const { c, fontSize } = useTheme();
  const allowed = useEntitlement('tracker');
  const [live, setLive] = useState<Live | null>(() => liveSummary());
  const [autoPause, setAutoPauseState] = useState(true);
  const [weight, setWeight] = useState('');
  const [message, setMessage] = useState<string>();
  const [finished, setFinished] = useState<Omit<LocalRun, 'synced'> | null>(null);
  const [busy, setBusy] = useState(false);
  const steps = useRef<number | null>(null);
  const stepSub = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    void getAutoPause().then(setAutoPauseState);
    void getWeightKg().then((w) => setWeight(w ? String(w) : ''));
  }, []);

  // Live numbers once a second while a run is in progress (also after the app was reopened mid-run).
  useEffect(() => {
    const t = setInterval(() => setLive(liveSummary()), 1000);
    return () => clearInterval(t);
  }, []);

  const watchSteps = async () => {
    // Owner: ask for the step permission at the first run start, not at app start; the run works if refused.
    try {
      if (!(await stepsPermissionAsked())) {
        await markStepsPermissionAsked();
        await Pedometer.requestPermissionsAsync();
      }
      const { granted } = await Pedometer.getPermissionsAsync();
      if (!granted || !(await Pedometer.isAvailableAsync())) return;
      steps.current = 0;
      stepSub.current = Pedometer.watchStepCount((r) => {
        steps.current = r.steps;
      });
    } catch {
      steps.current = null;
    }
  };

  const onStart = async () => {
    setMessage(undefined);
    setBusy(true);
    const kg = weight.trim() === '' ? null : Number(weight);
    await setWeightKg(kg !== null && kg >= 30 && kg <= 250 ? kg : null);
    await setAutoPausePref(autoPause);
    await watchSteps();
    const r = await startRun(autoPause);
    setBusy(false);
    if (!r.ok) {
      stepSub.current?.remove();
      return setMessage(
        r.reason === 'denied'
          ? 'Run tracking needs your location while the app is open. Allow it in your phone settings and try again.'
          : r.reason === 'services_off'
            ? 'Turn on your phone’s location, then start the run.'
            : 'The run could not start. Please try again.',
      );
    }
    setLive(liveSummary());
  };

  const onStop = () =>
    Alert.alert('Stop this run?', 'You can save it or discard it next.', [
      { text: 'Keep running', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            stepSub.current?.remove();
            const run = await stopRun({ steps: steps.current, weightKg: await getWeightKg() });
            setFinished(run);
            setLive(null);
          })();
        },
      },
    ]);

  const onSave = async () => {
    if (!finished) return;
    keepFinishedRun(finished);
    const s = await syncRuns();
    router.replace({ pathname: '/runs/[id]', params: { id: finished.id, saved: s.waiting ? 'offline' : '1' } });
  };

  if (allowed === false) {
    return (
      <Screen>
        <Notice tone="info">The run tracker is not included in your plan.</Notice>
      </Screen>
    );
  }

  if (finished) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Run finished', headerBackVisible: false }} />
        <View testID="run-summary" style={{ gap: 6 }}>
          <T variant="headline">{`${(finished.distance_m / 1000).toFixed(2)} km`}</T>
          <T>{`Moving time ${formatDuration(finished.moving_seconds)} · Pace ${formatPace(finished.avg_pace_sec_per_km)} /km`}</T>
          {finished.steps !== null ? <T variant="muted">{`${finished.steps} steps`}</T> : null}
          <T variant="muted">{`About ${finished.calories_est} kcal${finished.calories_basis === 'general' ? ' (general estimate: add your weight for a better one)' : ''}`}</T>
        </View>
        {finished.point_count > 1 ? (
          <RaceMap label="Your route" height={240} route={decodePolyline(finished.route_polyline).map((p) => [p.lng, p.lat] as [number, number])} showLabels={false} />
        ) : null}
        <Button label="Save run" onPress={() => void onSave()} />
        <Button
          label="Discard"
          variant="danger"
          onPress={() =>
            Alert.alert('Discard this run?', 'It will be deleted from this phone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Discard', style: 'destructive', onPress: () => (discardActiveRun(), router.back()) },
            ])
          }
        />
      </Screen>
    );
  }

  if (live) {
    const route = live.route.map((p) => [p.lng, p.lat] as [number, number]);
    return (
      <Screen>
        <Stack.Screen options={{ title: live.paused ? 'Paused' : 'Running', headerBackVisible: false, gestureEnabled: false }} />
        <View testID="run-live" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[
            ['Time', formatDuration(live.movingS)],
            ['Distance', `${(live.distanceM / 1000).toFixed(2)} km`],
            ['Pace', `${formatPace(live.avgPaceSPerKm)} /km`],
          ].map(([k, v]) => (
            <View key={k} style={{ alignItems: 'center', flex: 1 }}>
              <T variant="caption">{k}</T>
              <T style={{ fontSize: fontSize.headline, fontWeight: '800', color: c.ink }}>{v}</T>
            </View>
          ))}
        </View>
        {live.paused ? <Notice tone="info">Paused. Time and distance aren&apos;t counting.</Notice> : live.autoPaused ? <Notice tone="info">Auto-paused while you&apos;re stopped.</Notice> : null}
        <T variant="caption">Recording continues with the screen locked. A notification shows while the run is on.</T>
        <RaceMap key={Math.floor(route.length / 30)} label="Your route so far" height={260} route={route} showLabels={false} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T>Auto-pause</T>
          <Switch
            accessibilityLabel="Auto-pause"
            value={activeRun()?.autoPause ?? autoPause}
            onValueChange={(v) => {
              setAutoPause(v);
              setAutoPauseState(v);
              void setAutoPausePref(v);
            }}
          />
        </View>
        {live.paused ? <Button label="Resume" onPress={() => (resumeRun(), setLive(liveSummary()))} /> : <Button label="Pause" variant="secondary" onPress={() => (pauseRun(), setLive(liveSummary()))} />}
        <Button label="Stop" variant="danger" onPress={onStop} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Start run' }} />
      <T>Your run is private: only you see it. It works offline and uploads when you&apos;re back online.</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '700' }}>Auto-pause</T>
          <T variant="caption">Pauses when you stop (traffic lights, water) and resumes when you move.</T>
        </View>
        <Switch accessibilityLabel="Auto-pause" value={autoPause} onValueChange={setAutoPauseState} />
      </View>
      <TextField
        label="Body weight in kg (optional)"
        hint="Only for calorie estimates. Stays on this phone; never sent to RunLime."
        value={weight}
        onChangeText={setWeight}
        keyboardType="numeric"
        maxLength={5}
      />
      {message ? <Notice tone="danger">{message}</Notice> : null}
      <Button label="Start" onPress={() => void onStart()} busy={busy} />
    </Screen>
  );
}
