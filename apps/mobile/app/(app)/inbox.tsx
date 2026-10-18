import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, RefreshControl, View } from 'react-native';
import { Button, LinkRow, Notice, Screen, T, TextButton } from '@/components/ui';
import { markRead, notificationTarget, notificationUrl, useInbox, type AppNotification } from '@/lib/notifications';
import { useTheme } from '@/lib/theme';

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Intl.DateTimeFormat('en-TT', { day: 'numeric', month: 'short', timeZone: 'America/Port_of_Spain' }).format(new Date(iso));
};

/** M21: notification inbox. Works without push. */
export default function InboxScreen() {
  const router = useRouter();
  const { c, spacing, minTouchTarget } = useTheme();
  const { items, failed, refreshing, reload, setItems } = useInbox();
  const unread = (items ?? []).filter((n) => !n.read_at).length;

  const open = async (n: AppNotification) => {
    if (!n.read_at) {
      setItems((list) => (list ?? []).map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      await markRead([n.id]);
    }
    const url = notificationUrl(n);
    if (url) return void Linking.openURL(url).catch(() => undefined);
    const target = notificationTarget(n);
    if (target) router.push(target as never);
  };

  return (
    <Screen testID="inbox-scroll" refreshControl={<RefreshControl refreshing={refreshing && items !== null} onRefresh={() => void reload()} />}>
      {failed && !items ? (
        <Notice tone="danger">
          <T>Could not load notifications. Check your connection.</T>
          <Button label="Try again" variant="secondary" onPress={() => void reload()} />
        </Notice>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T variant="muted">{unread ? `${unread} unread` : 'All caught up'}</T>
        {unread ? (
          <TextButton
            label="Mark all as read"
            onPress={() => {
              setItems((list) => (list ?? []).map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
              void markRead();
            }}
          />
        ) : null}
      </View>
      {items && items.length === 0 ? <T variant="muted">No notifications yet. You&apos;ll see race changes, reminders, follow requests and club news here.</T> : null}
      {(items ?? []).map((n) => (
        <Pressable
          key={n.id}
          accessibilityRole="button"
          accessibilityLabel={`${n.read_at ? '' : 'Unread. '}${n.title}. ${n.body} ${ago(n.created_at)}`}
          onPress={() => void open(n)}
          style={{ flexDirection: 'row', gap: spacing.md, minHeight: minTouchTarget, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.border }}
        >
          <View style={{ width: 10, alignItems: 'center', paddingTop: 6 }}>{n.read_at ? null : <View testID="unread-dot" style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.leaf }} />}</View>
          <View style={{ flex: 1, gap: 2 }}>
            <T style={{ fontWeight: n.read_at ? '600' : '800' }}>{n.title}</T>
            {n.body ? <T variant="muted">{n.body}</T> : null}
            <T variant="caption">{ago(n.created_at)}</T>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.inkMuted} />
        </Pressable>
      ))}
      <LinkRow label="Notification settings" onPress={() => router.push('/notification-settings')} />
    </Screen>
  );
}
