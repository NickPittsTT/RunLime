import { useRef, useState } from 'react';
import { View, type NativeSyntheticEvent, type TextInput, type TextInputKeyPressEventData } from 'react-native';
import { Button, Notice, T, TextField } from './ui';

/**
 * Neutral age gate input (F1): plain day / month / year, no default value and no hint of the threshold.
 * Typing two digits in Day or Month moves on; "Next" moves on; "Done" on Year submits;
 * backspace in an empty box goes back to the previous box.
 */
export function DateOfBirthInput({ onSubmit, busy }: { onSubmit: (day: string, month: string, year: string) => void; busy?: boolean }) {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string>();
  const dayRef = useRef<TextInput>(null);
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const digits = (v: string) => v.replace(/\D/g, '');

  const submit = () => {
    if (!day || !month || year.length !== 4) {
      setError('Please enter your full date of birth.');
      return;
    }
    setError(undefined);
    onSubmit(day, month, year);
  };
  const isBackspace = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => e.nativeEvent.key === 'Backspace';

  return (
    <View style={{ gap: 16 }}>
      <T variant="title">What is your date of birth?</T>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Day"
            testID="dob-day"
            inputRef={dayRef}
            keyboardType="number-pad"
            maxLength={2}
            value={day}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => monthRef.current?.focus()}
            onChangeText={(v) => {
              const d = digits(v);
              setDay(d);
              if (d.length === 2) monthRef.current?.focus();
            }}
            placeholder="DD"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Month"
            testID="dob-month"
            inputRef={monthRef}
            keyboardType="number-pad"
            maxLength={2}
            value={month}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => yearRef.current?.focus()}
            onKeyPress={(e) => {
              if (isBackspace(e) && month === '') dayRef.current?.focus();
            }}
            onChangeText={(v) => {
              const m = digits(v);
              setMonth(m);
              if (m.length === 2) yearRef.current?.focus();
            }}
            placeholder="MM"
          />
        </View>
        <View style={{ flex: 1.4 }}>
          <TextField
            label="Year"
            testID="dob-year"
            inputRef={yearRef}
            keyboardType="number-pad"
            maxLength={4}
            value={year}
            returnKeyType="done"
            onSubmitEditing={submit}
            onKeyPress={(e) => {
              if (isBackspace(e) && year === '') monthRef.current?.focus();
            }}
            onChangeText={(v) => setYear(digits(v))}
            placeholder="YYYY"
          />
        </View>
      </View>
      <Button label="Continue" busy={busy} onPress={submit} />
    </View>
  );
}
