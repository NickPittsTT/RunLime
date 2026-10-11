import { Stack } from 'expo-router';
import { colors } from '@runlime/ui-tokens';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.forest, headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
      <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="emergency-contact" options={{ title: 'Emergency contact' }} />
      <Stack.Screen name="your-data" options={{ title: 'Your data' }} />
      <Stack.Screen name="legal" options={{ title: 'Help & legal' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
    </Stack>
  );
}
