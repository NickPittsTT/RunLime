import { useRouter } from 'expo-router';
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
      <T variant="headline">Hi, {profile.display_name}</T>
      <T variant="muted">{session?.user.email}</T>
      <Row label="Nickname" value={profile.nickname ?? '—'} />
      <Row label="Home area" value={area} />
      <Row label="Account" value={profile.account_privacy === 'public' ? 'Public' : 'Private'} />
      <LinkRow label="Edit profile & privacy" onPress={() => router.push('/edit-profile')} />
      <LinkRow label="Emergency contact" onPress={() => router.push('/emergency-contact')} />
      <LinkRow label="Your data" onPress={() => router.push('/your-data')} />
      <LinkRow label="Help & legal" onPress={() => router.push('/legal')} />
      <LinkRow label="Delete account" danger onPress={() => router.push('/delete-account')} />
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
