import { Stack } from 'expo-router';

/** The signed-in app. The tab bar is drawn by the screens for now. */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
