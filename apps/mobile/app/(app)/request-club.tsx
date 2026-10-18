import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AreaPicker } from '@/components/AreaPicker';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { requestNewClub } from '@/lib/clubs';
import { friendlyError } from '@/lib/errors';
import { useAreas } from '@/lib/regions';
import { useTheme } from '@/lib/theme';

type Leader = 'me' | 'someone';

/** Ask RunLime to add a club. An admin checks it; if approved, the person named here leads it and approves members. */
export default function RequestClubScreen() {
  const router = useRouter();
  const { c, radius, minTouchTarget } = useTheme();
  const { areas } = useAreas();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [leader, setLeader] = useState<Leader>('me');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sent) {
    return (
      <Screen>
        <Notice tone="success">Thanks. We&apos;ll review your club request.</Notice>
        <T>
          {leader === 'me'
            ? 'If it’s approved, the club appears in Clubs and you become its first leader, so you approve who joins.'
            : 'If it’s approved, the club appears in Clubs, the person you named becomes its first leader (we’ll tell them), and you join as a member.'}
        </T>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }
  const option = (value: Leader, label: string, help: string) => (
    <Pressable
      key={value}
      accessibilityRole="radio"
      accessibilityState={{ checked: leader === value }}
      accessibilityLabel={label}
      onPress={() => {
        setLeader(value);
        setError(undefined);
      }}
      style={{ minHeight: minTouchTarget, justifyContent: 'center', padding: 12, borderRadius: radius.md, borderWidth: leader === value ? 2 : 1, borderColor: leader === value ? c.leaf : c.border }}
    >
      <T style={{ fontWeight: leader === value ? '700' : '400' }}>{label}</T>
      <T variant="caption">{help}</T>
    </Pressable>
  );
  return (
    <Screen>
      <T variant="muted">Running clubs only. An admin checks each request before the club is listed.</T>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <TextField label="Club name" value={name} onChangeText={setName} maxLength={80} />
      <TextField label="About the club (optional)" value={description} onChangeText={setDescription} maxLength={500} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
      {areas ? <AreaPicker areas={areas} value={areaId} onChange={setAreaId} /> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="Who will lead this club?" style={{ gap: 8 }}>
        <T style={{ fontWeight: '700' }}>Who will lead this club?</T>
        <T variant="caption">The leader approves who joins. Members see the leader&apos;s name.</T>
        {option('me', 'Me', 'You approve join requests.')}
        {option('someone', 'Someone else', 'They need a RunLime account. Enter the email they sign in with.')}
      </View>
      {leader === 'someone' ? (
        <TextField
          label="Leader's sign-in email"
          hint="We only use it to find their account. They're told when the club is approved."
          value={leaderEmail}
          onChangeText={(v) => {
            setLeaderEmail(v);
            setError(undefined);
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          maxLength={254}
        />
      ) : null}
      <Button
        label="Send request"
        busy={busy}
        onPress={async () => {
          if (name.trim().length < 2) return setError('Enter the club name.');
          if (leader === 'someone' && !/^\S+@\S+\.\S+$/.test(leaderEmail.trim())) return setError('Enter the leader’s sign-in email, or choose Me.');
          setBusy(true);
          setError(undefined);
          const err = await requestNewClub(name.trim(), description.trim() || null, areaId, leader === 'someone' ? leaderEmail.trim() : null);
          setBusy(false);
          if (err) return setError(friendlyError(err));
          setSent(true);
        }}
      />
    </Screen>
  );
}
