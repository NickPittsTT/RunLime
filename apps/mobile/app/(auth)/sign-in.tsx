import * as AppleAuthentication from 'expo-apple-authentication';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { appleAvailable, googleConfigured, signInWithApple, signInWithGoogle } from '@/lib/socialSignIn';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';

/** M2: reachable only after the age gate passed in this app session. */
export default function SignInScreen() {
  const router = useRouter();
  const { passedDob } = useSession();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'email' | 'apple' | 'google' | null>(null);
  const [error, setError] = useState<string>();
  const [showApple, setShowApple] = useState(false);

  useEffect(() => {
    void appleAvailable().then(setShowApple);
  }, []);

  if (!passedDob) return <Redirect href="/" />;

  async function social(kind: 'apple' | 'google') {
    setBusy(kind);
    setError(undefined);
    try {
      await (kind === 'apple' ? signInWithApple() : signInWithGoogle());
      // On success the session listener moves the app to "Finish setting up" (DOB is checked again there).
    } catch (e) {
      setError(friendlyError(e as Error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <T variant="title">How would you like to sign in?</T>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {showApple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={10}
          style={{ height: 50 }}
          onPress={() => void social('apple')}
        />
      ) : null}
      {googleConfigured ? <Button label="Continue with Google" variant="secondary" busy={busy === 'google'} onPress={() => void social('google')} /> : null}
      <View style={{ gap: 12, marginTop: 8 }}>
        <TextField
          label="Email address"
          hint="We'll email you a 6-digit code. No password needed."
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <Button
          label="Email me a code"
          busy={busy === 'email'}
          disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}
          onPress={async () => {
            setBusy('email');
            setError(undefined);
            const { error: err } = await supabase.auth.signInWithOtp({
              email: email.trim(),
              options: { shouldCreateUser: true, data: { date_of_birth: passedDob } },
            });
            setBusy(null);
            if (err) setError(friendlyError(err));
            else router.push({ pathname: '/code', params: { email: email.trim() } });
          }}
        />
      </View>
    </Screen>
  );
}
