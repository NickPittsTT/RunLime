import { RSVP_OPTIONS } from '@runlime/shared/community';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { RaceCard } from '@/components/RaceCard';
import { Button, LinkRow, Notice, Screen, T } from '@/components/ui';
import { useMyRaces, type MyRace } from '@/lib/rsvp';

const groupText = (r: MyRace['rsvp']) => {
  const status = RSVP_OPTIONS.find((o) => o.value === r.status)?.label ?? r.status;
  const people = [r.adults > 1 ? `${r.adults} adults` : null, r.children > 0 ? `${r.children} ${r.children === 1 ? 'child' : 'children'}` : null].filter(Boolean).join(', ');
  return people ? `${status} · ${people}` : status;
};

/** M20: races you said Going or Maybe to. Upcoming first (soonest at the top), then past races. */
export default function MyRacesScreen() {
  const router = useRouter();
  const { races, failed, refreshing, reload } = useMyRaces();
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  const [cutoff] = useState(() => Date.now() - 6 * 3600_000);
  const upcoming = (races ?? []).filter((r) => new Date(r.event.starts_at).getTime() >= cutoff).sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
  const past = (races ?? []).filter((r) => new Date(r.event.starts_at).getTime() < cutoff).sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at));
  const open = (id: string) => router.push({ pathname: '/race/[id]', params: { id } });

  return (
    <Screen testID="my-races-scroll" refreshControl={<RefreshControl refreshing={refreshing && races !== null} onRefresh={() => void reload()} />}>
      {failed && races === null ? (
        <Notice tone="danger">
          <T>Could not load your races. Check your connection.</T>
          <Button label="Try again" variant="secondary" onPress={() => void reload()} />
        </Notice>
      ) : null}
      {races === null && !failed ? <T variant="muted">Loading your races…</T> : null}
      {races !== null && races.length === 0 ? (
        <>
          <T>You haven&apos;t said you&apos;re going to any races yet.</T>
          <LinkRow label="Find a race on the calendar" onPress={() => router.back()} />
        </>
      ) : null}
      {upcoming.length > 0 ? <T variant="title">Coming up</T> : null}
      {upcoming.map((r) => (
        <RaceCard key={r.event.id} event={r.event} badge={groupText(r.rsvp)} onPress={() => open(r.event.id)} />
      ))}
      {past.length > 0 ? <T variant="title">Past races</T> : null}
      {past.map((r) => (
        <RaceCard key={r.event.id} event={r.event} badge={groupText(r.rsvp)} onPress={() => open(r.event.id)} />
      ))}
    </Screen>
  );
}
