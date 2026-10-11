import { Stack } from 'expo-router';
import { colors } from '@runlime/ui-tokens';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.forest }}>
      <Stack.Screen name="index" options={{ title: 'Welcome to RunLime', headerShown: false }} />
      <Stack.Screen name="blocked" options={{ title: '', headerBackVisible: false, gestureEnabled: false }} />
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="code" options={{ title: 'Enter your code' }} />
    </Stack>
  );
}
