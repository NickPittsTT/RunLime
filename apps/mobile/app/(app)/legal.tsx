import { useRouter } from 'expo-router';
import { LinkRow, Screen, T } from '@/components/ui';
import { LEGAL_PAGES, openWebPage } from '@/lib/legalLinks';

export default function LegalScreen() {
  const router = useRouter();
  return (
    <Screen>
      <T variant="muted">RunLime is for adults 18+. Children are welcome at races with an adult, who adds them to their group.</T>
      <LinkRow label="Report a safety concern" onPress={() => router.push({ pathname: '/report', params: { kind: 'general' } })} />
      {LEGAL_PAGES.map((p) => (
        <LinkRow key={p.path} label={p.label} onPress={() => void openWebPage(p.path)} />
      ))}
    </Screen>
  );
}
