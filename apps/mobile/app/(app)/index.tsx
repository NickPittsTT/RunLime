import { Ionicons } from '@expo/vector-icons';
import { formatEventDate, todayKey } from '@runlime/shared/events';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@runlime/ui-tokens';
import { FilterSheet, NO_FILTERS, activeFilterCount, filterSummary, type RaceFilters } from '@/components/FilterSheet';
import { MonthPager } from '@/components/MonthPager';
import { RaceCard } from '@/components/RaceCard';
import { RaceMap } from '@/components/RaceMap';
import { SideMenu, type MenuItem } from '@/components/SideMenu';
import { TopBar } from '@/components/TopBar';
import { Button, Chip, LinkRow, Notice, Segmented, T, TextButton, TextField } from '@/components/ui';
import { calendarWindow, formatUpdated, useCalendar } from '@/lib/calendar';
import { getNearMe } from '@/lib/location';
import { loadPreferences } from '@/lib/preferences';
import { raceDayMarks, selectRaces } from '@/lib/raceQuery';
import { useAreas } from '@/lib/regions';
import { settingNumber, usePublicSettings } from '@/lib/settings';
import { useTheme } from '@/lib/theme';
import { useSession } from '@/state/session';

const TT = 'America/Port_of_Spain';

/** N1–N4 + M13/M14: Home = race calendar (month view + upcoming list), filters, search, near me, Start run. */
export default function HomeScreen() {
  const router = useRouter();
  const { c, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useSession();
  const { areas } = useAreas();
  const settings = usePublicSettings();
  const cal = useCalendar();

  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<RaceFilters>(NO_FILTERS);
  const [text, setText] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMsg, setNearMsg] = useState<string>();
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // First run: onboarding (M8/M9). Its answers become the default filters.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadPreferences().then((p) => {
        if (!active) return;
        if (!p.onboarded) {
          router.replace('/onboarding');
          return;
        }
        if (!prefsLoaded) {
          setFilters({ ...NO_FILTERS, regionIds: p.regionIds, distanceKm: p.distanceKm });
          setPrefsLoaded(true);
        }
      });
      return () => {
        active = false;
      };
    }, [router, prefsLoaded]),
  );

  const today = todayKey(TT);
  const { firstYear } = calendarWindow();
  const [ty, tm] = today.split('-').map(Number) as [number, number];
  const radiusKm = settingNumber(settings, 'calendar.near_me_radius_km', 25);
  const nearQ = near ? { ...near, radiusKm } : null;

  const events = cal.events ?? [];
  const races = useMemo(() => selectRaces(events, { filters, text, near: nearQ, day, today }), [events, filters, text, nearQ?.lat, nearQ?.lng, radiusKm, day, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayMarks = useMemo(() => raceDayMarks(events, { filters, text, near: nearQ }), [events, filters, text, nearQ?.lat, nearQ?.lng, radiusKm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!nearMsg) return;
    const t = setTimeout(() => setNearMsg(undefined), 6000);
    return () => clearTimeout(t);
  }, [nearMsg]);

  const toggleNear = () => {
    if (near) {
      setNear(null);
      return;
    }
    Alert.alert('Races near you', `RunLime uses your location once to show races within ${radiusKm} km. Your location stays on your phone and is not saved.`, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () =>
          void getNearMe().then((r) => {
            if (r.status === 'ok') setNear({ lat: r.lat, lng: r.lng });
            else if (r.status === 'denied') setNearMsg('Location permission is off. You can turn it on in your phone settings.');
            else setNearMsg('Could not get your location. Try again outside or check that location is on.');
          }),
      },
    ]);
  };

  const soon = (what: string) => () => Alert.alert(what, 'Coming soon.');
  const menu: MenuItem[] = [
    { key: 'my-races', label: 'My races', icon: 'flag-outline' },
    { key: 'leaderboards', label: 'Leaderboards', icon: 'trophy-outline' },
    { key: 'history', label: 'Run history', icon: 'time-outline' },
    { key: 'followers', label: 'Followers', icon: 'people-outline' },
    { key: 'clubs', label: 'Clubs', icon: 'shield-outline' },
    { key: 'suggest', label: 'Suggest a race', icon: 'add-circle-outline', onPress: () => router.push('/suggest-race') },
    { key: 'edit-profile', label: 'Edit profile & privacy', icon: 'person-circle-outline', onPress: () => router.push('/edit-profile') },
    { key: 'emergency', label: 'Emergency contact', icon: 'medkit-outline', onPress: () => router.push('/emergency-contact') },
    { key: 'data', label: 'Your data', icon: 'document-text-outline', onPress: () => router.push('/your-data') },
    { key: 'legal', label: 'Help & legal', icon: 'help-circle-outline', onPress: () => router.push('/legal') },
    { key: 'sign-out', label: 'Sign out', icon: 'log-out-outline', danger: true, onPress: () => void signOut() },
  ];

  const fc = activeFilterCount(filters);
  const START_RUN_SPACE = 96 + insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TopBar title="Races" onMenu={() => setMenuOpen(true)} onBell={soon('Notifications')} />
      {cal.offlineSince ? (
        <View style={{ backgroundColor: c.surface, borderBottomWidth: 1, borderColor: c.border, padding: spacing.sm }} accessibilityLiveRegion="polite">
          <T variant="caption" style={{ textAlign: 'center' }}>
            Offline. Showing races as last updated {formatUpdated(cal.offlineSince)}. Status changes since then are not shown. Pull down to refresh.
          </T>
        </View>
      ) : null}
      <ScrollView
        testID="races-scroll"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: START_RUN_SPACE }}
        refreshControl={<RefreshControl testID="races-refresh" refreshing={cal.refreshing && cal.events !== null} onRefresh={() => void cal.refresh()} />}
      >
        <MonthPager firstYear={firstYear} initial={{ year: ty, month: tm }} raceDays={dayMarks} today={today} selected={day} onSelect={setDay} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <TextField label="Search races" value={text} onChangeText={setText} placeholder="Race name or venue" returnKeyType="search" autoCorrect={false} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
            <Chip label={fc ? `Filters (${fc})` : 'Filters'} selected={fc > 0} onPress={() => setFiltersOpen(true)} accessibilityHint="Opens race filters" />
            <Chip label="Near me" selected={!!near} onPress={toggleNear} />
          </View>
          {fc > 0 ? (
            <View testID="filter-summary" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
              <T variant="muted" style={{ flexShrink: 1 }} numberOfLines={2}>
                Showing: {filterSummary(filters, areas)}
              </T>
              <TextButton label="Clear filters" onPress={() => setFilters(NO_FILTERS)} />
            </View>
          ) : null}
          <Segmented
            label="Show races as"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'list', label: 'List' },
              { value: 'map', label: 'Map' },
            ]}
          />
          {nearMsg ? <Notice>{nearMsg}</Notice> : null}
          <T variant="title">{day ? `Races on ${formatEventDate(`${day}T16:00:00Z`, 'UTC')}` : near ? `Races within ${radiusKm} km` : 'Upcoming races'}</T>
          {cal.updatedAt && !cal.offlineSince ? <T variant="caption">Updated {formatUpdated(cal.updatedAt)}. Pull down to refresh.</T> : null}
          {day ? <LinkRow label="Show all upcoming races" onPress={() => setDay(null)} /> : null}
          {cal.events === null && !cal.failed ? <T variant="muted">Loading races…</T> : null}
          {cal.failed ? (
            <Notice tone="danger">
              <T>Could not load races. Check your connection.</T>
              <Button label="Try again" variant="secondary" onPress={() => void cal.refresh()} />
            </Notice>
          ) : null}
          {cal.events !== null && races.length === 0 ? (
            <T variant="muted">{fc || text || near || day ? 'No races match. Try clearing filters or search.' : 'No upcoming races yet. Check back soon.'}</T>
          ) : null}
          {mode === 'map' && races.length > 0 ? (
            <RaceMap
              height={360}
              label={`Map of ${races.length} races`}
              pins={races.map((e) => ({ id: e.id, lat: e.start_lat, lng: e.start_lng, label: e.name }))}
              onPinPress={(id) => router.push({ pathname: '/race/[id]', params: { id } })}
            />
          ) : null}
          {mode === 'list' ? races.map((e) => <RaceCard key={e.id} event={e} near={near} onPress={() => router.push({ pathname: '/race/[id]', params: { id: e.id } })} />) : null}
          <LinkRow label="Know a race we're missing? Suggest it" onPress={() => router.push('/suggest-race')} />
        </View>
      </ScrollView>

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start run"
          accessibilityHint="Run tracking is coming soon"
          onPress={soon('Start run')}
          style={({ pressed }) => ({
            minHeight: 60,
            borderRadius: radius.pill,
            backgroundColor: colors.lime,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: pressed ? 0.85 : 1,
            elevation: 4,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          })}
        >
          <Ionicons name="play" size={22} color={colors.ink} />
          <T style={{ color: colors.ink, fontWeight: '800', fontSize: 18 }}>Start run</T>
        </Pressable>
      </View>

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        name={profile?.display_name ?? ''}
        nickname={profile?.nickname ?? null}
        avatarPath={profile?.avatar_path ?? null}
        stat="0 races · 0 km"
        onProfile={() => {
          setMenuOpen(false);
          router.push('/profile');
        }}
        items={menu}
      />
      <FilterSheet open={filtersOpen} value={filters} areas={areas} onChange={setFilters} onClose={() => setFiltersOpen(false)} />
    </View>
  );
}
