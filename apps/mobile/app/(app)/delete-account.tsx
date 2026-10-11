import { useState } from 'react';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';

/** M47: in-app account deletion (Apple 5.1.1(v), Google). Two-step confirmation. */
export default function DeleteAccountScreen() {
  const { signOut } = useSession();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Screen>
      <T variant="title">Delete your RunLime account</T>
      <T>
        This permanently deletes your account, profile, emergency contact and all your activity. It cannot be undone. Event totals stay but are
        no longer linked to you.
      </T>
      <Notice>Deleting your account does not cancel a Premium subscription. Cancel it in your App Store or Google Play settings.</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <TextField label="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} />
      <Button
        label="Delete my account"
        variant="danger"
        busy={busy}
        disabled={confirm.trim() !== 'DELETE'}
        onPress={async () => {
          setBusy(true);
          setError(undefined);
          const { error: err } = await supabase.rpc('delete_my_account');
          setBusy(false);
          if (err) return setError('We could not delete your account. Please try again or contact support.');
          await signOut();
        }}
      />
    </Screen>
  );
}
