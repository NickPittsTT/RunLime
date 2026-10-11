import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/** M3: enter the emailed code. On success the session listener routes onward. */
export default function CodeScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Screen>
      <T>
        We sent a code to <T style={{ fontWeight: '700' }}>{email}</T>.
      </T>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <TextField
        label="6-digit code"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
      />
      <Button
        label="Sign in"
        busy={busy}
        disabled={code.length !== 6}
        onPress={async () => {
          setBusy(true);
          setError(undefined);
          const { error: err } = await supabase.auth.verifyOtp({ email: String(email), token: code, type: 'email' });
          setBusy(false);
          if (err) setError(friendlyError({ message: `otp ${err.message}` }));
        }}
      />
    </Screen>
  );
}
