import '@/global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { C } from '@/gs/theme';
import { useSessionStatus, useIsAuthed, useAuthUser, bootstrap } from '@/gs/auth';

export default function RootLayout() {
  // Fonts load in the background; the app renders with the system fallback
  // until they arrive rather than holding the navigator back.
  useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const status = useSessionStatus();
  const isAuthed = useIsAuthed();
  const mustChangePassword = useAuthUser()?.mustChangePassword ?? false;

  // Restore a persisted session once, at app start — not per route, so every
  // entry point (deep link included) sees the same answer.
  useEffect(() => {
    void bootstrap();
  }, []);

  // The navigator is mounted on EVERY render, fonts or not. Returning null here
  // instead would leave expo-router with no root navigator, and any navigation
  // before it appears throws "Attempted to navigate before mounting the Root
  // Layout". `index` is likewise never guarded: it is the fallback route that
  // Stack.Protected falls back TO, and it renders its own spinner until the
  // session is known.
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.canvas } }}>
        <Stack.Screen name="index" />

        {/* Guards, not effects. When a guard turns false expo-router removes
            the screen and falls back to `index` in the same commit — which is
            what makes sign-out work: clearing the session unmounts the tabs
            instead of leaving them mounted to refetch and 401. */}
        <Stack.Protected guard={isAuthed && mustChangePassword}>
          {/* A user with a pending forced change must not reach the tab bar,
              where every request 403s. */}
          <Stack.Screen name="change-password" options={{ gestureEnabled: false }} />
        </Stack.Protected>

        {/* `status !== 'ready'` keeps this screen in the navigator while
            bootstrap() is still running. Dropping it during that window would
            throw away the deep link: opening /profile in a signed-in app would
            fall back to `index` and never come back, because a guard turning
            true does not navigate. (app)/_layout holds its own render until the
            session is known, so nothing fetches without a token. */}
        <Stack.Protected guard={status !== 'ready' || (isAuthed && !mustChangePassword)}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
