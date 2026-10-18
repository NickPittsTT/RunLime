import { feeLabel, formatEventDate, formatEventTime, postponementInfo } from '@runlime/shared/events';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Image, Linking, RefreshControl, Share, View } from 'react-native';
import { RaceMap } from '@/components/RaceMap';
import { RsvpPanel } from '@/components/RsvpPanel';
import { StatusBanner } from '@/components/StatusBanner';
import { Button, LinkRow, Notice, Row, Screen, T } from '@/components/ui';
import { formatUpdated } from '@/lib/calendar';
import { eventMediaUrl, raceWebUrl, useRace } from '@/lib/raceDetail';
import { settingText, usePublicSettings } from '@/lib/settings';
import { useTheme } from '@/lib/theme';

/** M16: race details. RunLime does not take registrations or fees; "Register" opens the organiser's official link. */
export default function RaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c, spacing, radius } = useTheme();
  const { race: e, state, reload, updatedAt, offline, refreshing } = useRace(id);
  const refresh = <RefreshControl testID="race-refresh" refreshing={refreshing} onRefresh={() => void reload()} />;
  const settings = usePublicSettings();

  if (state === 'loading' && !e) {
    return (
      <Screen>
        <T variant="muted">Loading race…</T>
      </Screen>
    );
  }
  if (state === 'error' && !e) {
    return (
      <Screen>
        <Notice tone="danger">Could not load this race. Check your connection.</Notice>
        <Button label="Try again" variant="secondary" onPress={() => void reload()} />
      </Screen>
    );
  }
  if (!e) {
    return (
      <Screen refreshControl={refresh} testID="race-scroll">
        <Stack.Screen options={{ title: 'Race' }} />
        <T>This race is no longer listed.</T>
      </Screen>
    );
  }

  const minors = settingText(settings, 'legal.minors_notice');
  const unaffiliated = settingText(settings, 'events.unaffiliated_notice');
  const isListing = e.listing_source === 'runlime';
  const media = [...e.event_media].sort((a, b) => a.sort - b.sort);
  const sponsors = [...e.event_sponsors].sort((a, b) => a.sort - b.sort);
  const web = raceWebUrl(e.slug);
  const postponed = postponementInfo(e);

  return (
    <Screen refreshControl={refresh} testID="race-scroll">
      <Stack.Screen options={{ title: 'Race details' }} />
      {offline && updatedAt ? (
        <Notice>{`Offline. Showing this race as last updated ${formatUpdated(updatedAt)}. Pull down to refresh.`}</Notice>
      ) : null}
      <StatusBanner status={e.status} reason={e.status_reason} postponement={postponed} />
      <T variant="headline">{e.name}</T>
      <View style={{ gap: 2 }}>
        <T style={{ fontSize: 18, textDecorationLine: postponed && !postponed.hasNewDate ? 'line-through' : 'none' }}>
          {formatEventDate(e.starts_at, e.timezone)} · {formatEventTime(e.starts_at, e.timezone)}
        </T>
        <T variant="muted">
          {e.venue_name}
          {e.regions?.name ? `, ${e.regions.name}` : ''}
        </T>
      </View>
      {isListing && unaffiliated ? <Notice>{unaffiliated}</Notice> : null}

      {e.registration_url ? (
        <Button
          label="Register with the organiser"
          accessibilityHint="Opens the organiser's official page in your browser"
          onPress={() => void WebBrowser.openBrowserAsync(e.registration_url!)}
        />
      ) : null}
      <RsvpPanel eventId={e.id} eventStatus={e.status} startsAt={e.starts_at} />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button label="Add to calendar" variant="secondary" onPress={() => void Linking.openURL(`${web}/calendar.ics`)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Share" variant="secondary" onPress={() => void Share.share({ title: e.name, message: `${e.name}, ${formatEventDate(e.starts_at, e.timezone)}: ${web}` })} />
        </View>
      </View>

      <View>
        <Row label="Distances" value={e.distances.map((d) => d.label).join(' · ')} />
        <Row label="Entry" value={`${feeLabel(e)} (paid to the organiser)`} />
        {e.walk_friendly ? <Row label="Walkers" value="Walkers welcome" /> : null}
        {e.cause || e.charity_name ? <Row label="Cause" value={[e.cause, e.charity_name].filter(Boolean).join(' · ')} /> : null}
      </View>

      {minors ? (
        <Notice>
          <T>
            <T style={{ fontWeight: '800' }}>Children: </T>
            {minors}
          </T>
        </Notice>
      ) : null}

      <RaceMap height={220} interactive={false} label={`Map of the start${e.route ? ' and route' : ''}`} pins={[{ id: e.id, lat: e.start_lat, lng: e.start_lng, label: `Start: ${e.venue_name}` }]} route={e.route} />
      <LinkRow label={e.route ? 'Full-screen route map' : 'Full-screen map'} onPress={() => router.push({ pathname: '/race/map', params: { id: e.id } })} />

      {e.description ? <T>{e.description}</T> : null}
      {(
        [
          ['How to register', e.registration_instructions],
          ['Race-pack collection', e.package_collection],
          ['Parking', e.parking],
        ] as const
      ).map(([title, body]) =>
        body ? (
          <View key={title} style={{ gap: 4 }}>
            <T variant="title">{title}</T>
            <T>{body}</T>
          </View>
        ) : null,
      )}
      {e.contact_email || e.contact_phone ? (
        <View style={{ gap: 4 }}>
          <T variant="title">Contact the organiser</T>
          {e.contact_email ? <LinkRow label={e.contact_email} onPress={() => void Linking.openURL(`mailto:${e.contact_email}`)} /> : null}
          {e.contact_phone ? <LinkRow label={e.contact_phone} onPress={() => void Linking.openURL(`tel:${e.contact_phone!.replace(/[^\d+]/g, '')}`)} /> : null}
        </View>
      ) : null}
      {media.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <T variant="title">Flyer and photos</T>
          {media.map((m) => (
            <Image
              key={m.id}
              source={{ uri: eventMediaUrl(m.storage_path) }}
              accessibilityLabel={m.alt_text ?? `${e.name} ${m.kind}`}
              resizeMode="contain"
              style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: c.surface }}
            />
          ))}
        </View>
      ) : null}
      {sponsors.length > 0 ? (
        <View style={{ gap: 4 }}>
          <T variant="title">Sponsors</T>
          {sponsors.map((s) => (s.url ? <LinkRow key={s.id} label={s.name} onPress={() => void WebBrowser.openBrowserAsync(s.url!)} /> : <T key={s.id}>{s.name}</T>))}
        </View>
      ) : null}
      <T variant="caption">RunLime does not take registrations, entry fees or official times. Results and timing come from the organiser.</T>
      {updatedAt && !offline ? <T variant="caption">Updated {formatUpdated(updatedAt)}. Pull down to refresh.</T> : null}
    </Screen>
  );
}
