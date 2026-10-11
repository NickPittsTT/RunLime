import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { AgeBlocked } from '@/components/AgeBlocked';
import { DateOfBirthInput } from '@/components/DateOfBirthInput';
import { Notice, Screen, T } from '@/components/ui';
import { isRecentlyBlocked, runAgeGate } from '@/lib/ageGate';
import { useTheme } from '@/lib/theme';
import { useSession } from '@/state/session';

/** M4: the first screen for anyone not signed in. Runs before any sign-in method (F1). */
export default function AgeGateScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { setPassedDob } = useSession();
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [error, setError] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void isRecentlyBlocked().then((b) => active && setBlocked(b));
      return () => {
        active = false;
      };
    }, []),
  );

  if (blocked === null) return null;

  return (
    <Screen>
      <View style={{ gap: 8, paddingTop: 48 }}>
        <T variant="headline">
          run<T variant="headline" style={{ color: c.leaf }}>lime</T>
        </T>
        <T variant="muted">The 5K race calendar and run tracker for Trinidad and Tobago.</T>
      </View>
      {blocked ? (
        <AgeBlocked />
      ) : (
        <>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <DateOfBirthInput
            onSubmit={async (d, m, y) => {
              const result = await runAgeGate(d, m, y);
              if (result.status === 'allowed') {
                setPassedDob(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
                router.push('/sign-in');
              } else if (result.status === 'blocked') {
                setPassedDob(null);
                router.replace('/blocked');
              } else {
                setError('Please enter a valid date of birth.');
              }
            }}
          />
        </>
      )}
    </Screen>
  );
}
