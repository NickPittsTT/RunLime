import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AreaPicker } from '@/components/AreaPicker';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { requestNewClub } from '@/lib/clubs';
import { friendlyError } from '@/lib/errors';
import { useAreas } from '@/lib/regions';

/** Ask RunLime to add a club. An admin checks it; if approved you become its first leader. */
export default function RequestClubScreen() {
  const router = useRouter();
  const { areas } = useAreas();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sent) {
    return (
      <Screen>
        <Notice tone="success">Thanks. We&apos;ll review your club request.</Notice>
        <T>If it&apos;s approved, the club appears in Clubs and you become its first leader, so you can approve members.</T>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }
  return (
    <Screen>
      <T variant="muted">Running clubs only. An admin checks each request before the club is listed.</T>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <TextField label="Club name" value={name} onChangeText={setName} maxLength={80} />
      <TextField label="About the club (optional)" value={description} onChangeText={setDescription} maxLength={500} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
      {areas ? <AreaPicker areas={areas} value={areaId} onChange={setAreaId} /> : null}
      <Button
        label="Send request"
        busy={busy}
        onPress={async () => {
          if (name.trim().length < 2) return setError('Enter the club name.');
          setBusy(true);
          setError(undefined);
          const err = await requestNewClub(name.trim(), description.trim() || null, areaId);
          setBusy(false);
          if (err) return setError(friendlyError(err));
          setSent(true);
        }}
      />
    </Screen>
  );
}
