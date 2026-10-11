import { useState } from 'react';
import { View } from 'react-native';
import { Button, Notice, T, TextField } from './ui';

/** Neutral age gate input (F1): plain day / month / year, no default value and no hint of the threshold. */
export function DateOfBirthInput({ onSubmit, busy }: { onSubmit: (day: string, month: string, year: string) => void; busy?: boolean }) {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string>();
  const digits = (v: string) => v.replace(/\D/g, '');
  return (
    <View style={{ gap: 16 }}>
      <T variant="title">What is your date of birth?</T>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Day" testID="dob-day" keyboardType="number-pad" maxLength={2} value={day} onChangeText={(v) => setDay(digits(v))} placeholder="DD" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Month" testID="dob-month" keyboardType="number-pad" maxLength={2} value={month} onChangeText={(v) => setMonth(digits(v))} placeholder="MM" />
        </View>
        <View style={{ flex: 1.4 }}>
          <TextField label="Year" testID="dob-year" keyboardType="number-pad" maxLength={4} value={year} onChangeText={(v) => setYear(digits(v))} placeholder="YYYY" />
        </View>
      </View>
      <Button
        label="Continue"
        busy={busy}
        onPress={() => {
          if (!day || !month || year.length !== 4) {
            setError('Please enter your full date of birth.');
            return;
          }
          setError(undefined);
          onSubmit(day, month, year);
        }}
      />
    </View>
  );
}
