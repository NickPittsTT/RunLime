import type { ReportTarget } from '@runlime/shared/community';
import { useRouter } from 'expo-router';
import { TextButton } from './ui';

/** "Report" link shown on other people's profiles, photos and clubs. */
export function ReportButton({ kind, userId, refId, name, label = 'Report' }: { kind: ReportTarget; userId?: string; refId?: string; name?: string; label?: string }) {
  const router = useRouter();
  return (
    <TextButton
      label={label}
      accessibilityHint="Opens a form to report this to RunLime"
      onPress={() => router.push({ pathname: '/report', params: { kind, ...(userId ? { userId } : {}), ...(refId ? { ref: refId } : {}), ...(name ? { name } : {}) } })}
    />
  );
}
