import { raceSuggestionSchema } from '@runlime/shared/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/** M48: suggest a race we are missing. An admin checks it and may add it as a RunLime listing. */
export default function SuggestRaceScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <Screen>
        <Notice tone="success">Thanks! We will check the race and add it if we can confirm the details with the organiser.</Notice>
        <Button label="Back to races" onPress={() => router.back()} />
      </Screen>
    );
  }

  const submit = async () => {
    const parsed = raceSuggestionSchema.safeParse({ name, eventDate: date, location, url, notes });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.path[0] === 'eventDate' ? 'Use YYYY-MM-DD, e.g. 2031-03-01' : i.message])));
      return;
    }
    setErrors({});
    setError(undefined);
    setBusy(true);
    const v = parsed.data;
    const { error: err } = await supabase.rpc('suggest_race', {
      p_name: v.name,
      p_event_date: v.eventDate ?? null,
      p_location: v.location ?? null,
      p_url: v.url ?? null,
      p_notes: v.notes ?? null,
    });
    setBusy(false);
    if (err) setError(friendlyError(err));
    else setDone(true);
  };

  return (
    <Screen>
      <T variant="muted">Tell us about a race that is not in the calendar. We check every suggestion before listing it.</T>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <TextField label="Race name" value={name} onChangeText={setName} error={errors.name} maxLength={140} />
      <TextField label="Date (optional)" hint="YYYY-MM-DD" value={date} onChangeText={setDate} error={errors.eventDate} keyboardType="numbers-and-punctuation" maxLength={10} />
      <TextField label="Where (optional)" value={location} onChangeText={setLocation} error={errors.location} maxLength={200} />
      <TextField label="Official link (optional)" hint="Organiser's page or social post" value={url} onChangeText={setUrl} error={errors.url} autoCapitalize="none" keyboardType="url" />
      <TextField label="Anything else (optional)" value={notes} onChangeText={setNotes} error={errors.notes} multiline maxLength={1000} style={{ minHeight: 96, textAlignVertical: 'top' }} />
      <Button label="Send suggestion" onPress={() => void submit()} busy={busy} />
    </Screen>
  );
}
