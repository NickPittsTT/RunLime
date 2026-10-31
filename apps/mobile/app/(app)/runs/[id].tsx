import { decodePolyline, formatDuration, formatPace, toGpx } from '@runlime/shared/runs';
import { File, Paths } from 'expo-file-system';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { RaceMap } from '@/components/RaceMap';
import { Button, Notice, Screen, T } from '@/components/ui';
import { deleteRun, loadRuns, type RunItem } from '@/lib/runSync';

/** M24: one run: map, numbers, splits, GPX export, delete. Private to the runner. */
export default function RunDetail() {
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const router = useRouter();
  const [run, setRun] = useState<RunItem | null | undefined>(undefined);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    void loadRuns().then((r) => active && setRun(r.runs.find((x) => x.id === id) ?? null));
    return () => {
      active = false;
    };
  }, [id]);

  if (run === undefined) return <Screen><T variant="muted">Loading…</T></Screen>;
  if (run === null) return <Screen><T>This run can&apos;t be found.</T></Screen>;
  const points = decodePolyline(run.route_polyline);
  const name = `RunLime run ${run.started_at.slice(0, 10)}`;

  const exportGpx = async () => {
    try {
      const file = new File(Paths.cache, `runlime-run-${run.started_at.slice(0, 10)}-${run.id.slice(0, 8)}.gpx`);
      file.write(toGpx({ name, startedAt: run.started_at, points }));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/gpx+xml', dialogTitle: 'Export run as GPX', UTI: 'com.topografix.gpx' });
    } catch {
      setMessage('The GPX file could not be shared. Please try again.');
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Run' }} />
      {saved === '1' ? <Notice tone="success">Saved.</Notice> : saved === 'offline' ? <Notice tone="info">Saved on this phone. It uploads when you&apos;re online.</Notice> : null}
      <T variant="headline">{`${(run.distance_m / 1000).toFixed(2)} km`}</T>
      <T>{`Moving time ${formatDuration(run.moving_seconds)} (total ${formatDuration(run.elapsed_seconds)}) · Pace ${formatPace(run.avg_pace_sec_per_km)} /km`}</T>
      {run.raceName ? <T>{`Race: ${run.raceName}`}</T> : null}
      {run.steps !== null ? <T variant="muted">{`${run.steps} steps`}</T> : null}
      {run.calories_est !== null ? <T variant="muted">{`About ${run.calories_est} kcal${run.calories_basis === 'general' ? ' (general estimate)' : ''}`}</T> : null}
      {points.length > 1 ? <RaceMap label="Run route" height={260} route={points.map((p) => [p.lng, p.lat] as [number, number])} showLabels={false} /> : null}
      <T variant="caption">Only you can see this route.</T>
      {run.splits.length ? (
        <View testID="run-splits" style={{ gap: 2 }}>
          <T variant="title">Splits</T>
          {run.splits.map((s, i) => (
            <T key={i}>{`Km ${i + 1}: ${formatPace(s)}`}</T>
          ))}
        </View>
      ) : null}
      {message ? <Notice tone="danger">{message}</Notice> : null}
      <Button label="Export GPX" variant="secondary" onPress={() => void exportGpx()} />
      <Button
        label="Delete run"
        variant="danger"
        onPress={() =>
          Alert.alert('Delete this run?', 'It is deleted from RunLime and this phone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => void deleteRun(run.id).then((ok) => (ok ? router.back() : setMessage('The run could not be deleted. Check your connection and try again.'))),
            },
          ])
        }
      />
    </Screen>
  );
}
