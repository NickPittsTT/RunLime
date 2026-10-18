import { Stack } from 'expo-router';
import { colors } from '@runlime/ui-tokens';

/** N1–N4: no tab bar. Home (race calendar) has its own top bar + side menu; other screens push on top. */
export default function AppLayout() {
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
    </Stack>
  );
}
