import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { PersonRow } from '@/components/PersonRow';
import { ReportButton } from '@/components/ReportButton';
import { Button, Notice, Row, Screen, T, TextButton } from '@/components/ui';
import { fetchClubPage, leaveClub, removeMember, requestJoin, respondJoin, setPrimaryClub, type ClubPage } from '@/lib/clubs';
import { friendlyError } from '@/lib/errors';

async function load(id: string): Promise<ClubPage | null> {
  try {
    return await fetchClubPage(id);
  } catch {
    return null;
  }
}

/** Club page: join (a leader approves), leave, primary club; leaders approve requests and manage members. */
export default function ClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [club, setClub] = useState<ClubPage | null | undefined>(undefined);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string }>();
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => setClub(await load(id)), [id]);
  useEffect(() => {
    void load(id).then(setClub);
  }, [id]);

  if (club === undefined) {
    return (
      <Screen>
        <T variant="muted">Loading…</T>
      </Screen>
    );
  }
  if (club === null) {
    return (
      <Screen>
        <T>This club can&apos;t be found.</T>
      </Screen>
    );
  }
  const act = async (fn: () => Promise<{ message?: string; code?: string } | null>, ok: string) => {
    setBusy(true);
    setMessage(undefined);
    const err = await fn();
    setMessage(err ? { tone: 'danger', text: friendlyError(err) } : { tone: 'success', text: ok });
    await reload();
    setBusy(false);
  };
  const me = club.me;
  const leaderNames = club.leaders.map((l) => l.display_name).join(' or ');

  return (
    <Screen>
      <Stack.Screen options={{ title: club.name }} />
      <T variant="headline">{club.name}</T>
      {club.description ? <T>{club.description}</T> : null}
      <Row label="Members" value={String(club.members)} />
      {club.area ? <Row label="Area" value={club.area} /> : null}
      <Row label={club.leaders.length === 1 ? 'Leader' : 'Leaders'} value={club.leaders.map((l) => l.display_name).join(', ') || 'None yet'} />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {!me ? (
        <>
          <T variant="caption">{leaderNames ? `${leaderNames} ${club.leaders.length === 1 ? 'approves' : 'approve'} join requests.` : 'A club leader approves join requests.'}</T>
          <Button label="Ask to join" busy={busy} onPress={() => void act(() => requestJoin(club.id), 'Request sent. A club leader will approve it.')} />
        </>
      ) : me.status === 'pending' ? (
        <>
          <Notice>{leaderNames ? `Your request is waiting for ${leaderNames} to approve it.` : 'Your request is waiting for a club leader to approve it.'}</Notice>
          <Button label="Cancel request" variant="secondary" busy={busy} onPress={() => void act(() => leaveClub(club.id), 'Request cancelled.')} />
        </>
      ) : (
        <>
          <Notice tone="success">{me.role === 'leader' ? 'You lead this club.' : 'You are a member.'}</Notice>
          {me.is_primary ? (
            <T>★ This is your primary club. Your leaderboard activity will count for it.</T>
          ) : (
            <Button label="Make this my primary club" variant="secondary" busy={busy} onPress={() => void act(() => setPrimaryClub(club.id), 'This is now your primary club.')} />
          )}
          <Button
            label="Leave club"
            variant="secondary"
            onPress={() =>
              Alert.alert(`Leave ${club.name}?`, me.role === 'leader' ? 'You will stop being a leader. You can ask to join again later.' : 'You can ask to join again later.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: () => void act(() => leaveClub(club.id), `You left ${club.name}.`) },
              ])
            }
          />
        </>
      )}

      {club.is_leader ? (
        <View style={{ gap: 6, marginTop: 8 }}>
          <T variant="title">Requests to join{club.requests?.length ? ` (${club.requests.length})` : ''}</T>
          {club.requests?.length ? null : <T variant="muted">No requests waiting.</T>}
          {club.requests?.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })}
              actions={
                <>
                  <TextButton label="Approve" onPress={() => void act(() => respondJoin(club.id, p.id, true), `${p.display_name} is now a member.`)} />
                  <TextButton label="Decline" onPress={() => void act(() => respondJoin(club.id, p.id, false), 'Request declined.')} />
                </>
              }
            />
          ))}
          <T variant="title">Members</T>
          {club.member_list?.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })}
              actions={p.role === 'leader' ? <T variant="caption">Leader</T> : <TextButton label="Remove" onPress={() => void act(() => removeMember(club.id, p.id), `${p.display_name} was removed.`)} />}
            />
          ))}
        </View>
      ) : null}
      <View style={{ marginTop: 8 }}>
        <ReportButton kind="club" refId={club.id} name={club.name} label="Report this club" />
      </View>
    </Screen>
  );
}
