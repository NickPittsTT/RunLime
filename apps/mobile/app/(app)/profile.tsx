import { useRouter } from 'expo-router';
import { runnerLevelLabel } from '@runlime/shared/community';
import { Avatar } from '@/components/Avatar';
import { useAreas } from '@/lib/regions';
import { Button, LinkRow, Row, Screen, T } from '@/components/ui';
import { useSession } from '@/state/session';

/** M39: full profile (opened from the side-menu header). */
export default function ProfileScreen() {
  const router = useRouter();
  const { profile, session, signOut } = useSession();
  const { areas } = useAreas();
  if (!profile) return null;
  const area = areas?.find((a) => a.id === profile.home_region_id)?.name ?? '…';
  return (
    <Screen>
      <Avatar name={profile.display_name} path={profile.avatar_path} size={88} />
      <T variant="headline">Hi, {profile.display_name}</T>
      <T variant="muted">{session?.user.email}</T>
      <Row label="Nickname" value={profile.nickname ?? '—'} />
      <Row label="Home area" value={area} />
      <Row label="Account" value={profile.account_privacy === 'public' ? 'Public' : 'Private'} />
      <Row label="Runner level" value={runnerLevelLabel(profile.runner_level) ?? 'Not set'} />
      <LinkRow label="Followers & following" onPress={() => router.push('/people')} />
      <LinkRow label="Edit profile & privacy" onPress={() => router.push('/edit-profile')} />
      <LinkRow label="Your areas and distances" onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })} />
      <LinkRow label="Emergency contact" onPress={() => router.push('/emergency-contact')} />
      <LinkRow label="Your data" onPress={() => router.push('/your-data')} />
      <LinkRow label="Help & legal" onPress={() => router.push('/legal')} />
      <LinkRow label="Report a safety concern" onPress={() => router.push({ pathname: '/report', params: { kind: 'general' } })} />
      <LinkRow label="Delete account" danger onPress={() => router.push('/delete-account')} />
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
