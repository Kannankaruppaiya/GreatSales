import { Stack } from 'expo-router';

/** The pre-sign-in flow: splash, login, and the location screens after it. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
