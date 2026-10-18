import { RSVP_CHILDREN_NOTE, RSVP_OPTIONS, goingLabel, rsvpSchema, type RsvpStatus } from '@runlime/shared/community';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { friendlyError } from '@/lib/errors';
import { fetchMyRsvp, fetchRsvpCounts, saveRsvp } from '@/lib/rsvp';
import { settingNumber, usePublicSettings } from '@/lib/settings';
import { fetchFollowingGoing, type Person } from '@/lib/social';
import { fetchClubTurnout } from '@/lib/clubs';
import { shouldOfferPush } from '@/lib/push';
import { useSession } from '@/state/session';
import { useTheme } from '@/lib/theme';
import { Stepper } from './Stepper';
import { Button, Notice, T, TextButton } from './ui';

/** M18 RSVP sheet + M19 count: Going / Maybe / Not going, with the number of adults and children in your group. */
export function RsvpPanel({ eventId, eventStatus, startsAt }: { eventId: string; eventStatus: string; startsAt: string }) {
  const router = useRouter();
  const { profile } = useSession();
  const { c, spacing, radius, minTouchTarget } = useTheme();
  const [friends, setFriends] = useState<Person[]>([]);
  const [clubs, setClubs] = useState<{ club_id: string; club_name: string; going: number }[]>([]);
  const settings = usePublicSettings();
  const maxAdults = settingNumber(settings, 'rsvp.max_adults', 10);
  const maxChildren = settingNumber(settings, 'rsvp.max_children', 10);
  const [status, setStatus] = useState<RsvpStatus | null>(null);
  const [saved, setSaved] = useState<{ status: RsvpStatus; adults: number; children: number } | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [count, setCount] = useState<{ going: number; maybe: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string }>();

  useEffect(() => {
    void fetchMyRsvp(eventId).then((r) => {
      if (!r) return;
      setSaved(r);
      setStatus(r.status);
      setAdults(r.adults);
      setChildren(r.children);
    });
    void fetchRsvpCounts([eventId]).then((m) => setCount(m.get(eventId) ?? { going: 0, maybe: 0 }));
    void fetchFollowingGoing(eventId).then(setFriends);
    void fetchClubTurnout(eventId).then(setClubs);
  }, [eventId]);

  const [past] = useState(() => new Date(startsAt).getTime() < Date.now() - 6 * 3600_000);
  const closed = eventStatus === 'cancelled' || past;
  const label = count ? goingLabel(count.going, count.maybe) : null;
  const unchanged = saved && saved.status === status && (status === 'not_going' || (saved.adults === adults && saved.children === children));

  return (
    <View testID="rsvp-panel" style={{ gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border }}>
      <T variant="title">Are you going?</T>
      <T variant="muted" testID="rsvp-count">
        {label ?? 'No one has said they are going yet.'}
      </T>
      {clubs.map((cl) => (
        <T key={cl.club_id} testID="club-turnout" variant="muted">
          {cl.club_name}: {cl.going} going
        </T>
      ))}
      {friends.length > 0 ? (
        <View testID="friends-going" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm }}>
          <T variant="caption">People you follow who are going:</T>
          {friends.map((f) => (
            <TextButton key={f.id} label={f.display_name} accessibilityHint="Opens their profile" onPress={() => router.push({ pathname: '/person/[id]', params: { id: f.id } })} />
          ))}
        </View>
      ) : null}
      {closed ? (
        <T variant="muted">{eventStatus === 'cancelled' ? 'This race is cancelled, so RSVPs are closed.' : 'This race has taken place.'}</T>
      ) : (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel="Your RSVP" style={{ flexDirection: 'row', gap: spacing.sm }}>
            {RSVP_OPTIONS.map((o) => {
              const selected = status === o.value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={o.label}
                  onPress={() => {
                    setStatus(o.value);
                    setMessage(undefined);
                  }}
                  style={{ flex: 1, minHeight: minTouchTarget, borderRadius: radius.pill, borderWidth: 2, borderColor: c.leaf, backgroundColor: selected ? c.leaf : c.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}
                >
                  <T style={{ color: selected ? '#FFFFFF' : c.leaf, fontWeight: '800' }}>{o.label}</T>
                </Pressable>
              );
            })}
          </View>
          {status === 'going' || status === 'maybe' ? (
            <>
              <Stepper label="Adults in your group" hint="Including you" value={adults} min={1} max={maxAdults} onChange={setAdults} unit={['adult', 'adults']} />
              <Stepper label="Children under 18" hint="Coming with your group" value={children} min={0} max={maxChildren} onChange={setChildren} unit={['child', 'children']} />
              <T variant="caption">{RSVP_CHILDREN_NOTE}</T>
            </>
          ) : null}
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          {status ? (
            <Button
              label={saved ? 'Update RSVP' : 'Save RSVP'}
              busy={busy}
              disabled={Boolean(unchanged)}
              onPress={async () => {
                const parsed = rsvpSchema(maxAdults, maxChildren).safeParse({ status, adults, children });
                if (!parsed.success) return setMessage({ tone: 'danger', text: parsed.error.issues[0]?.message ?? 'Check your group.' });
                setBusy(true);
                setMessage(undefined);
                const err = await saveRsvp(eventId, parsed.data);
                if (err) {
                  setBusy(false);
                  return setMessage({ tone: 'danger', text: friendlyError(err) });
                }
                setSaved(parsed.data.status === 'not_going' ? { ...parsed.data, adults: 1, children: 0 } : parsed.data);
                setCount((await fetchRsvpCounts([eventId])).get(eventId) ?? { going: 0, maybe: 0 });
                setBusy(false);
                // First Going/Maybe: offer phone notifications (explainer first; Android asks only after it).
                if (parsed.data.status !== 'not_going' && profile && (await shouldOfferPush(profile.id))) router.push('/notifications-explainer');
                setMessage({ tone: 'success', text: parsed.data.status === 'going' ? 'You\'re going. It\'s in My races.' : parsed.data.status === 'maybe' ? 'Saved as Maybe. It\'s in My races.' : 'Saved as Not going.' });
              }}
            />
          ) : null}
        </>
      )}
    </View>
  );
}
