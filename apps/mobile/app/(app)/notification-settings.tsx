import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Notice, Screen, T } from '@/components/ui';
import { DEFAULT_SETTINGS, NOTIFICATION_TYPES, fetchNotificationSettings, saveNotificationSettings, type NotificationSettings } from '@/lib/notifications';
import { openSystemSettings, pushStatus, type PushStatus } from '@/lib/push';
import { useTheme } from '@/lib/theme';
import { useSession } from '@/state/session';

/** Turn each notification type on or off (in-app inbox and, once allowed, push). */
export default function NotificationSettingsScreen() {
  const { c, radius, minTouchTarget } = useTheme();
  const { profile } = useSession();
  const [s, setS] = useState<NotificationSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string }>();
  const router = useRouter();
  const [push, setPush] = useState<PushStatus | null>(null);
  useFocusEffect(
    useCallback(() => {
      void pushStatus().then(setPush);
    }, []),
  );
  useEffect(() => {
    void fetchNotificationSettings().then(setS, () => setS(DEFAULT_SETTINGS));
  }, []);
  if (!s || !profile) {
    return (
      <Screen>
        <T variant="muted">Loading…</T>
      </Screen>
    );
  }
  return (
    <Screen>
      <View style={{ gap: 6, padding: 12, borderRadius: radius.md, backgroundColor: c.surface }}>
        <T style={{ fontWeight: '700' }}>Phone notifications: {push === 'on' ? 'On' : push === null ? '…' : 'Off'}</T>
        {push === 'off' ? <Button label="Turn on phone notifications" variant="secondary" onPress={() => router.push('/notifications-explainer')} /> : null}
        {push === 'denied' ? (
          <>
            <T variant="caption">They&apos;re turned off for RunLime in your phone&apos;s settings.</T>
            <Button label="Open phone settings" variant="secondary" onPress={openSystemSettings} />
          </>
        ) : null}
        <T variant="caption">The bell inbox always shows everything, whether phone notifications are on or not.</T>
      </View>
      <T variant="muted">Choose what RunLime tells you about. Notices that we removed your photo are always sent.</T>
      {NOTIFICATION_TYPES.map((t) => (
        <Pressable
          key={t.key}
          accessibilityRole="switch"
          accessibilityState={{ checked: s[t.key] }}
          accessibilityLabel={t.label}
          accessibilityHint={t.help}
          onPress={() => setS({ ...s, [t.key]: !s[t.key] })}
          style={{ minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border }}
        >
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700' }}>{t.label}</T>
            <T variant="caption">{t.help}</T>
          </View>
          <T style={{ fontWeight: '800', color: s[t.key] ? c.leaf : c.inkMuted }}>{s[t.key] ? 'On' : 'Off'}</T>
        </Pressable>
      ))}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Button
        label="Save"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          const err = await saveNotificationSettings(profile.id, s);
          setBusy(false);
          setMessage(err ? { tone: 'danger', text: 'Could not save. Please try again.' } : { tone: 'success', text: 'Saved.' });
        }}
      />
    </Screen>
  );
}
