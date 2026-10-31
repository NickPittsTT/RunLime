import { formatEventTime } from '@runlime/shared/events';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Notice, T, TextField } from '@/components/ui';
import { checkIn, fetchCheckinStatus, readCheckinPosition, requestCheckinHelp, windowState, type CheckinStatus } from '@/lib/checkin';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/lib/theme';

const HOW: Record<string, string> = { gps: 'by GPS', approved_after_correction: 'approved after the race pin was corrected', manual: 'confirmed by a RunLime admin' };

/** Race page: GPS check-in (Phase 4). Shown for live races; counts as a race attended. */
export function CheckInPanel({ eventId, timezone }: { eventId: string; timezone: string }) {
  const { c, radius } = useTheme();
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string }>();
  const [canAskHelp, setCanAskHelp] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => setStatus(await fetchCheckinStatus(eventId)), [eventId]);
  useEffect(() => {
    let active = true;
    void fetchCheckinStatus(eventId).then((s) => active && setStatus(s));
    return () => {
      active = false;
    };
  }, [eventId]);

  if (!status || !status.live) return null;
  const w = windowState(status);
  const time = (iso: string) => formatEventTime(iso, timezone);

  const onCheckIn = async () => {
    setBusy(true);
    setMessage(undefined);
    const fix = await readCheckinPosition();
    if (fix.status === 'denied') {
      setBusy(false);
      return setMessage({ tone: 'danger', text: 'Check-in needs your location while the app is open. Allow it in your phone settings, then try again.' });
    }
    if (fix.status === 'unavailable') {
      setBusy(false);
      return setMessage({ tone: 'danger', text: 'Your phone could not find your location. Turn on location, step outside if you can, and try again.' });
    }
    const { result, error } = await checkIn(eventId, fix);
    setBusy(false);
    if (error) return setMessage({ tone: 'danger', text: friendlyError(error) });
    if (!result) return;
    if (result.result === 'ok' || result.result === 'already') {
      setMessage({ tone: 'success', text: "You're checked in. It counts as a race attended." });
      setCanAskHelp(false);
    } else if (result.result === 'too_far') {
      setMessage({ tone: 'danger', text: `Your phone places you about ${result.distance_m} m from the start; check-in works within ${result.radius_m} m. Move closer to the start and try again.` });
      setCanAskHelp(true);
    } else if (result.result === 'too_early') {
      setMessage({ tone: 'info', text: `Check-in opens at ${time(result.opens_at!)}.` });
    } else if (result.result === 'too_late') {
      setMessage({ tone: 'info', text: 'Check-in for this race has closed.' });
    } else {
      setMessage({ tone: 'info', text: 'This race is not running at the moment.' });
    }
    await load();
  };

  const onHelp = async () => {
    setBusy(true);
    const error = await requestCheckinHelp(eventId, note);
    setBusy(false);
    if (error) return setMessage({ tone: 'danger', text: friendlyError(error) });
    setCanAskHelp(false);
    setMessage({ tone: 'success', text: 'Sent. A RunLime admin will check and confirm your check-in if they can.' });
    await load();
  };

  return (
    <View testID="checkin-panel" style={{ gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.border }}>
      <T variant="title">Race-day check-in</T>
      {status.checked_in ? (
        <Notice tone="success">{`Checked in at ${time(status.checked_in_at!)}, ${HOW[status.check_in_status ?? 'gps']}.`}</Notice>
      ) : w === 'before' ? (
        <T variant="muted">{`Check-in opens at ${time(status.opens_at)} (1 hour before the start) and works within ${status.radius_m} m of the start.`}</T>
      ) : w === 'after' ? (
        <T variant="muted">Check-in for this race has closed.</T>
      ) : (
        <>
          <T variant="muted">{`Tap when you're at the race (within ${status.radius_m} m of the start). Your phone's location is read once and stored rounded to about 100 m.`}</T>
          <Button label="Check in" onPress={() => void onCheckIn()} busy={busy} />
        </>
      )}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {status.help_request === 'pending' && !status.checked_in ? <Notice tone="info">{`Your "I'm here but can't check in" request is waiting for an admin.`}</Notice> : null}
      {canAskHelp && status.help_request !== 'pending' ? (
        <View style={{ gap: 8 }}>
          <TextField label="Anything that helps us confirm you're there (optional)" value={note} onChangeText={setNote} maxLength={500} multiline />
          <Button label="I'm here but can't check in" variant="secondary" onPress={() => void onHelp()} busy={busy} />
        </View>
      ) : null}
    </View>
  );
}
