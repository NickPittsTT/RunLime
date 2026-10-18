import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { Button, LinkRow, Notice, Screen, T, TextField } from '@/components/ui';
import { fetchClubDirectory, type ClubRow } from '@/lib/clubs';
import { useTheme } from '@/lib/theme';

function ClubCard({ club, onPress }: { club: ClubRow; onPress: () => void }) {
  const { c, radius, spacing } = useTheme();
  const status = club.my_status === 'approved' ? (club.my_role === 'leader' ? 'Leader' : 'Member') : club.my_status === 'pending' ? 'Request sent' : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[club.name, status, club.is_primary ? 'Primary club' : null, `${club.members} member${club.members === 1 ? '' : 's'}`, club.area].filter(Boolean).join(', ')}
      onPress={onPress}
      style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, gap: 2 }}
    >
      <T style={{ fontWeight: '800' }}>
        {club.name}
        {club.is_primary ? ' ★' : ''}
      </T>
      <T variant="caption">
        {[status, `${club.members} member${club.members === 1 ? '' : 's'}`, club.area].filter(Boolean).join(' · ')}
      </T>
    </Pressable>
  );
}

/** M45a: your clubs, find a club, ask for a new one. */
export default function ClubsScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ClubRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (term = '') => {
    setRefreshing(true);
    try {
      setRows(await fetchClubDirectory(term));
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
    const t = setTimeout(() => void load(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const mine = (rows ?? []).filter((r) => r.my_status);
  const others = (rows ?? []).filter((r) => !r.my_status);
  const open = (id: string) => router.push({ pathname: '/club/[id]', params: { id } });

  return (
    <Screen testID="clubs-scroll" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(q.trim())} />}>
      {failed && !rows ? (
        <Notice tone="danger">
          <T>Could not load clubs. Check your connection.</T>
          <Button label="Try again" variant="secondary" onPress={() => void load()} />
        </Notice>
      ) : null}
      {mine.length > 0 ? <T variant="title">Your clubs</T> : null}
      <View style={{ gap: 8 }}>
        {mine.map((r) => (
          <ClubCard key={r.id} club={r} onPress={() => open(r.id)} />
        ))}
      </View>
      <T variant="title">Find a club</T>
      <TextField label="Search clubs" value={q} onChangeText={setQ} placeholder="Club name" autoCorrect={false} />
      {rows && others.length === 0 ? <T variant="muted">{q ? 'No clubs match.' : 'No other clubs yet.'}</T> : null}
      <View style={{ gap: 8 }}>
        {others.map((r) => (
          <ClubCard key={r.id} club={r} onPress={() => open(r.id)} />
        ))}
      </View>
      <LinkRow label="Can't find your club? Ask us to add it" onPress={() => router.push('/request-club')} />
    </Screen>
  );
}
