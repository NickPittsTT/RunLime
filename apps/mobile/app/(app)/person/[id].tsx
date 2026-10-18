import { runnerLevelLabel } from '@runlime/shared/community';
import { formatEventDate, formatEventTime } from '@runlime/shared/events';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { ReportButton } from '@/components/ReportButton';
import { Button, LinkRow, Notice, Row, Screen, T } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { blockUser, fetchPassport, fetchProfileCard, followUser, unfollowUser, type Passport, type ProfileCard } from '@/lib/social';

async function fetchPerson(id: string): Promise<{ card: ProfileCard | null; passport: Passport | null }> {
  try {
    const card = await fetchProfileCard(id);
    return { card, passport: card?.can_see_details ? await fetchPassport(id) : null };
  } catch {
    return { card: null, passport: null };
  }
}

/** M39 (someone else): photo, name, runner level, follow button; race passport and races attending when allowed. */
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<ProfileCard | null | undefined>(undefined);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string }>();

  const apply = useCallback((r: { card: ProfileCard | null; passport: Passport | null }) => {
    setCard(r.card);
    setPassport(r.passport);
  }, []);
  const load = useCallback(async () => apply(await fetchPerson(id)), [apply, id]);
  useEffect(() => {
    void fetchPerson(id).then(apply);
  }, [apply, id]);

  if (card === undefined) {
    return (
      <Screen>
        <T variant="muted">Loading…</T>
      </Screen>
    );
  }
  if (card === null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Profile' }} />
        <T>This person can&apos;t be found.</T>
      </Screen>
    );
  }

  const followLabel = card.following === 'accepted' ? 'Following' : card.following === 'pending' ? 'Requested' : card.account_privacy === 'public' ? 'Follow' : 'Ask to follow';
  const onFollow = async () => {
    setBusy(true);
    setMessage(undefined);
    const err = card.following ? await unfollowUser(card.id) : await followUser(card.id);
    if (err) setMessage({ tone: 'danger', text: friendlyError(err) });
    else if (!card.following && card.account_privacy === 'private') setMessage({ tone: 'success', text: `Request sent. ${card.display_name} needs to approve it.` });
    await load();
    setBusy(false);
  };
  const onBlock = () =>
    Alert.alert(`Block ${card.display_name}?`, 'They will no longer be able to follow you or find you, and you won\'t see each other. They are not told.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          void blockUser(card.id).then((err) => {
            if (err) setMessage({ tone: 'danger', text: friendlyError(err) });
            else router.back();
          }),
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: card.display_name }} />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar name={card.display_name} path={card.avatar_path} size={96} />
        <T variant="headline">{card.display_name}</T>
        {card.nickname ? <T variant="muted">{card.nickname}</T> : null}
        <T variant="caption">
          {card.followers} follower{card.followers === 1 ? '' : 's'} · {card.following_count} following
          {card.follows_you === 'accepted' ? ' · Follows you' : ''}
        </T>
      </View>
      {runnerLevelLabel(card.runner_level) ? <Row label="Runner level" value={runnerLevelLabel(card.runner_level)!} /> : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {!card.is_me ? (
        <Button
          label={followLabel}
          variant={card.following ? 'secondary' : 'primary'}
          busy={busy}
          accessibilityHint={card.following === 'accepted' ? 'Tap to unfollow' : card.following === 'pending' ? 'Tap to cancel your request' : undefined}
          onPress={() => void onFollow()}
        />
      ) : null}
      {card.can_see_details && passport ? (
        <View style={{ gap: 8 }}>
          <T variant="title">Race passport</T>
          <Row label="Races attended" value={String(passport.races_attended)} />
          <Row label="Total km" value={String(passport.total_km)} />
          <T variant="caption">Races attended and kilometres fill in with race check-ins and run tracking (coming soon).</T>
          <T variant="title">Going to</T>
          {passport.attending.length === 0 ? <T variant="muted">No upcoming races.</T> : null}
          {passport.attending.map((e) => (
            <LinkRow key={e.id} label={`${e.name} · ${formatEventDate(e.starts_at, e.timezone)}, ${formatEventTime(e.starts_at, e.timezone)}`} onPress={() => router.push({ pathname: '/race/[id]', params: { id: e.id } })} />
          ))}
        </View>
      ) : !card.is_me ? (
        <Notice>
          <T>This account is private. When {card.display_name} approves your request you&apos;ll see their race passport and the races they&apos;re going to.</T>
        </Notice>
      ) : null}
      {!card.is_me ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
          <ReportButton kind="profile" userId={card.id} name={card.display_name} label="Report profile" />
          {card.avatar_path ? <ReportButton kind="profile_photo" userId={card.id} name={card.display_name} label="Report photo" /> : null}
          <Button label="Block" variant="secondary" onPress={onBlock} />
        </View>
      ) : null}
    </Screen>
  );
}
