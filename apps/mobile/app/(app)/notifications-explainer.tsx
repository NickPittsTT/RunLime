import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Notice, Screen, T } from '@/components/ui';
import { enablePush, markPushOffered, openSystemSettings, type PushStatus } from '@/lib/push';
import { useTheme } from '@/lib/theme';
import { useSession } from '@/state/session';

/** M10: why notifications help, before the system prompt (Android 13+ asks only after this). */
export default function NotificationsExplainer() {
  const router = useRouter();
  const { c } = useTheme();
  const { profile } = useSession();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PushStatus>();
  if (!profile) return null;
  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <Ionicons name="notifications" size={48} color={c.leaf} />
      </View>
      <T variant="headline">Get race updates on your phone?</T>
      <T>We&apos;ll only tell you about things that matter to you:</T>
      <T>• A race you&apos;re going to is postponed (with the new date) or cancelled</T>
      <T>• A reminder the day before your race</T>
      <T>• Updates from the race organiser (at most 2 per race per week)</T>
      <T>• Follow requests and club approvals</T>
      <T variant="caption">No ads. Choose exactly which ones in Notification settings, or turn them off any time in your phone&apos;s settings. Everything is also in the bell inbox.</T>
      {result === 'denied' ? (
        <Notice>
          <T>Notifications are off for RunLime in your phone&apos;s settings.</T>
          <Button label="Open phone settings" variant="secondary" onPress={openSystemSettings} />
        </Notice>
      ) : null}
      {result === 'unavailable' ? <Notice>Phone notifications aren&apos;t available in this test version yet. You&apos;ll still see everything in the bell inbox.</Notice> : null}
      {result === 'on' ? <Notice tone="success">Notifications are on.</Notice> : null}
      {result === 'on' || result === 'unavailable' || result === 'denied' ? (
        <Button label="Done" onPress={() => router.back()} />
      ) : (
        <>
          <Button
            label="Turn on notifications"
            busy={busy}
            onPress={async () => {
              setBusy(true);
              setResult(await enablePush(profile.id));
              setBusy(false);
            }}
          />
          <Button
            label="Not now"
            variant="secondary"
            onPress={() => {
              void markPushOffered(profile.id);
              router.back();
            }}
          />
        </>
      )}
    </Screen>
  );
}
