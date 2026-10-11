import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Button, Notice, Screen, T } from '@/components/ui';
import { callFunction } from '@/lib/edgeFunctions';

/** M46: download all personal data as a JSON file. */
export default function YourDataScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Screen>
      <T>Download a copy of everything RunLime holds about you: your account, profile, consents, clubs and emergency contact.</T>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        label="Download my data"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          setError(undefined);
          try {
            const res = await callFunction('export-user-data', { method: 'POST' });
            if (!res.ok) throw new Error();
            const file = new File(Paths.cache, 'runlime-my-data.json');
            if (file.exists) file.delete();
            file.create();
            file.write(await res.text());
            await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your RunLime data' });
          } catch {
            setError('We could not prepare your download. Please try again.');
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
