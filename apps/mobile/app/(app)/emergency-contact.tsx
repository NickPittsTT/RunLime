import { emergencyContactSchema, type EmergencyContact } from '@runlime/shared/schemas';
import { useEffect, useState } from 'react';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { callFunction } from '@/lib/edgeFunctions';

/** M43: stored encrypted; only you can read it. */
export default function EmergencyContactScreen() {
  const [loaded, setLoaded] = useState(false);
  const [contact, setContact] = useState<EmergencyContact>({ name: '', phone: '', relationship: '' });
  const [hasSaved, setHasSaved] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await callFunction('emergency-contact');
        const body = (await res.json()) as { contact: EmergencyContact | null };
        if (body.contact) {
          setContact({ relationship: '', ...body.contact });
          setHasSaved(true);
        }
      } catch {
        setMessage({ tone: 'danger', text: 'Could not load your emergency contact. Check your connection.' });
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  if (!loaded) return null;
  return (
    <Screen>
      <T variant="muted">Optional. Stored encrypted and visible only to you — RunLime staff and organisers cannot see it.</T>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <TextField label="Name" value={contact.name} onChangeText={(name) => setContact({ ...contact, name })} maxLength={80} />
      <TextField label="Phone" value={contact.phone} onChangeText={(phone) => setContact({ ...contact, phone })} keyboardType="phone-pad" autoComplete="tel" />
      <TextField label="Relationship (optional)" value={contact.relationship ?? ''} onChangeText={(relationship) => setContact({ ...contact, relationship })} maxLength={40} />
      <Button
        label="Save"
        busy={busy}
        onPress={async () => {
          const parsed = emergencyContactSchema.safeParse({ ...contact, relationship: contact.relationship?.trim() || undefined });
          if (!parsed.success) return setMessage({ tone: 'danger', text: parsed.error.issues[0]?.message ?? 'Check the details.' });
          setBusy(true);
          try {
            const res = await callFunction('emergency-contact', { method: 'PUT', body: JSON.stringify(parsed.data) });
            if (!res.ok) throw new Error();
            setHasSaved(true);
            setMessage({ tone: 'success', text: 'Saved.' });
          } catch {
            setMessage({ tone: 'danger', text: 'Could not save. Please try again.' });
          } finally {
            setBusy(false);
          }
        }}
      />
      {hasSaved ? (
        <Button
          label="Remove emergency contact"
          variant="secondary"
          onPress={async () => {
            const res = await callFunction('emergency-contact', { method: 'DELETE' }).catch(() => null);
            if (res?.ok) {
              setContact({ name: '', phone: '', relationship: '' });
              setHasSaved(false);
              setMessage({ tone: 'success', text: 'Removed.' });
            } else setMessage({ tone: 'danger', text: 'Could not remove. Please try again.' });
          }}
        />
      ) : null}
    </Screen>
  );
}
