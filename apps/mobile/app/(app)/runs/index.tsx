import { formatDuration, formatPace, totalsOf } from '@runlime/shared/runs';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { Button, LinkRow, Notice, Screen, T } from '@/components/ui';
import { loadRuns, loadTotals, syncRuns, type RunItem, type ServerTotals } from '@/lib/runSync';
import { useTheme } from '@/lib/theme';

const day = (iso: string) => new Intl.DateTimeFormat('en-TT', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Port_of_Spain' }).format(new Date(iso));

/** M23: run history with totals (runs, km, time) and per-race totals. Private to the runner. */
export default function RunHistory() {
  const router = useRouter();
  const { c, radius } = useTheme();
  const [runs, setRuns] = useState<RunItem[] | null>(null);
  const [totals, setTotals] = useState<ServerTotals | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await syncRuns();
    const r = await loadRuns();
    setRuns(r.runs);
    setOffline(r.offline);
    setTotals(await loadTotals());
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const t = runs ? totalsOf(runs) : null;
  const waiting = runs?.filter((r) => !r.synced).length ?? 0;
  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), void load().finally(() => setRefreshing(false)))} />}
      testID="runs-scroll"
    >
      <Button label="Start a run" onPress={() => router.push('/run')} />
      {t ? (
        <View testID="run-totals" style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.border }}>
          {[
            ['Runs', String(t.runs)],
            ['Distance', `${(t.distanceM / 1000).toFixed(1)} km`],
            ['Time', formatDuration(t.movingS)],
            ['Races', String(totals?.races_attended ?? 0)],
          ].map(([k, v]) => (
            <View key={k} style={{ alignItems: 'center', flex: 1 }}>
              <T variant="caption">{k}</T>
              <T style={{ fontWeight: '800' }}>{v}</T>
            </View>
          ))}
        </View>
      ) : null}
      {offline ? <Notice tone="info">Offline: showing the runs on this phone.</Notice> : null}
      {waiting ? <Notice tone="info">{`${waiting} run${waiting === 1 ? '' : 's'} waiting to upload. They upload when you're online.`}</Notice> : null}
      {totals && totals.per_race.length ? (
        <View style={{ gap: 4 }}>
          <T variant="title">Races</T>
          {totals.per_race.map((r) => (
            <T key={r.event_id}>{`${r.name}: ${(r.distance_m / 1000).toFixed(2)} km in ${formatDuration(r.moving_seconds)}`}</T>
          ))}
        </View>
      ) : null}
      <T variant="title">Your runs</T>
      {runs && runs.length === 0 ? <T variant="muted">No runs yet. Tap Start a run.</T> : null}
      {runs?.map((r) => (
        <LinkRow
          key={r.id}
          label={`${day(r.started_at)} · ${(r.distance_m / 1000).toFixed(2)} km · ${formatPace(r.avg_pace_sec_per_km)} /km${r.raceName ? ` · ${r.raceName}` : ''}${r.synced ? '' : ' · waiting to upload'}`}
          onPress={() => router.push({ pathname: '/runs/[id]', params: { id: r.id } })}
        />
      ))}
    </Screen>
  );
}
