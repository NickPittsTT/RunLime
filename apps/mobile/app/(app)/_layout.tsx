import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { notificationTarget, type AppNotification } from '@/lib/notifications';
import { colors } from '@runlime/ui-tokens';

/** N1–N4: no tab bar. Home (race calendar) has its own top bar + side menu; other screens push on top. */
/** Tapping a phone notification opens the same screen as tapping it in the inbox. */
function useOpenTappedNotifications() {
  const router = useRouter();
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const content = r?.notification.request.content;
      if (!content) return;
      const data = (content.data ?? {}) as Record<string, unknown>;
      const target = notificationTarget({ id: '', kind: String(data.kind ?? ''), title: content.title ?? '', body: content.body ?? '', data, created_at: '', read_at: null } as AppNotification);
      if (target) router.push(target as never);
    };
    void Notifications.getLastNotificationResponseAsync().then(open, () => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);
}

export default function AppLayout() {
  useOpenTappedNotifications();
  return (
    <Stack screenOptions={{ headerTintColor: colors.forest, headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Races' }} />
      <Stack.Screen name="onboarding" options={{ title: 'Welcome' }} />
      <Stack.Screen name="race/[id]" options={{ title: 'Race details' }} />
      <Stack.Screen name="race/map" options={{ title: 'Map' }} />
      <Stack.Screen name="suggest-race" options={{ title: 'Suggest a race' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="emergency-contact" options={{ title: 'Emergency contact' }} />
      <Stack.Screen name="your-data" options={{ title: 'Your data' }} />
      <Stack.Screen name="legal" options={{ title: 'Help & legal' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
      <Stack.Screen name="report" options={{ title: 'Report' }} />
      <Stack.Screen name="my-races" options={{ title: 'My races' }} />
      <Stack.Screen name="people" options={{ title: 'Followers' }} />
      <Stack.Screen name="person/[id]" options={{ title: 'Profile' }} />
      <Stack.Screen name="clubs" options={{ title: 'Clubs' }} />
      <Stack.Screen name="club/[id]" options={{ title: 'Club' }} />
      <Stack.Screen name="request-club" options={{ title: 'Ask for a new club' }} />
      <Stack.Screen name="inbox" options={{ title: 'Notifications' }} />
      <Stack.Screen name="notification-settings" options={{ title: 'Notification settings' }} />
      <Stack.Screen name="notifications-explainer" options={{ title: 'Notifications' }} />
    </Stack>
  );
}
