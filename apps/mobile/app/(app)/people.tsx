import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { PersonRow } from '@/components/PersonRow';
import { Button, Notice, Screen, Segmented, T, TextButton, TextField } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { fetchConnections, removeFollower, respondRequest, searchPeople, unblockUser, unfollowUser, type Connections, type Person } from '@/lib/social';

type Tab = 'followers' | 'following' | 'requests';

/** M45: followers, following, follow requests, find people, blocked people. */
export default function PeopleScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('followers');
  const [data, setData] = useState<Connections | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string }>();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Person[] | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await fetchConnections());
      setFailed(false);
    } catch {
      setFailed(true);
    }
    setRefreshing(false);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => {
      void searchPeople(term).then(setResults, () => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const act = async (fn: () => Promise<{ message?: string; code?: string } | null>, ok: string) => {
    setMessage(undefined);
    const err = await fn();
    setMessage(err ? { tone: 'danger', text: friendlyError(err) } : { tone: 'success', text: ok });
    await load();
  };
  const open = (id: string) => router.push({ pathname: '/person/[id]', params: { id } });
  const requests = data?.requests.length ?? 0;
  const searching = q.trim().length >= 2;

  return (
    <Screen testID="people-scroll" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}>
      <TextField label="Find people" value={q} onChangeText={(v) => (setQ(v), v.trim().length < 2 && setResults(null))} placeholder="Name or nickname" autoCorrect={false} returnKeyType="search" />
      {searching ? (
        <View>
          {results === null ? <T variant="muted">Searching…</T> : results.length === 0 ? <T variant="muted">No one found.</T> : null}
          {(results ?? []).map((p) => (
            <PersonRow key={p.id} person={p} onPress={() => open(p.id)} />
          ))}
        </View>
      ) : (
        <>
          <Segmented<Tab>
            stretch
            label="People"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'followers', label: `Followers${data ? ` (${data.followers.length})` : ''}` },
              { value: 'following', label: `Following${data ? ` (${data.following.length})` : ''}` },
              { value: 'requests', label: `Requests${requests ? ` (${requests})` : ''}` },
            ]}
          />
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          {failed && !data ? (
            <Notice tone="danger">
              <T>Could not load. Check your connection.</T>
              <Button label="Try again" variant="secondary" onPress={() => void load()} />
            </Notice>
          ) : null}
          {data && tab === 'followers' ? (
            data.followers.length === 0 ? (
              <T variant="muted">No followers yet.</T>
            ) : (
              data.followers.map((p) => (
                <PersonRow key={p.id} person={p} onPress={() => open(p.id)} actions={<TextButton label="Remove" accessibilityHint={`Removes ${p.display_name} from your followers`} onPress={() => void act(() => removeFollower(p.id), `${p.display_name} no longer follows you.`)} />} />
              ))
            )
          ) : null}
          {data && tab === 'following' ? (
            <>
              {data.following.length === 0 && data.sent.length === 0 ? <T variant="muted">You don&apos;t follow anyone yet. Find people above.</T> : null}
              {data.following.map((p) => (
                <PersonRow key={p.id} person={p} onPress={() => open(p.id)} actions={<TextButton label="Unfollow" onPress={() => void act(() => unfollowUser(p.id), `You unfollowed ${p.display_name}.`)} />} />
              ))}
              {data.sent.length > 0 ? <T variant="caption">Requests you sent (waiting for approval)</T> : null}
              {data.sent.map((p) => (
                <PersonRow key={p.id} person={p} onPress={() => open(p.id)} actions={<TextButton label="Cancel" accessibilityHint="Cancels your follow request" onPress={() => void act(() => unfollowUser(p.id), 'Request cancelled.')} />} />
              ))}
            </>
          ) : null}
          {data && tab === 'requests' ? (
            data.requests.length === 0 ? (
              <T variant="muted">No follow requests. Your account is {''}private by default, so new followers need your approval here.</T>
            ) : (
              data.requests.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  onPress={() => open(p.id)}
                  actions={
                    <>
                      <TextButton label="Approve" onPress={() => void act(() => respondRequest(p.id, true), `${p.display_name} now follows you.`)} />
                      <TextButton label="Decline" onPress={() => void act(() => respondRequest(p.id, false), 'Request declined.')} />
                    </>
                  }
                />
              ))
            )
          ) : null}
          {data && data.blocked.length > 0 ? (
            <View style={{ gap: 4, marginTop: 16 }}>
              <T variant="title">Blocked</T>
              {data.blocked.map((b) => (
                <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
                  <T>{b.display_name}</T>
                  <TextButton label="Unblock" onPress={() => void act(() => unblockUser(b.id), `${b.display_name} is unblocked.`)} />
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
