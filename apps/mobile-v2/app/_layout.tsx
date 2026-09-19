import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Caveat_400Regular } from '@expo-google-fonts/caveat';
import { queryClient } from '../src/lib/queryClient';
import '../src/global.css';

/**
 * The root layout. Not a screen - it is what lets the screens render at all.
 *
 * Both families the design uses are loaded here. Plus Jakarta Sans carries
 * 1,576 text runs across the 56 boards at five weights; Caveat carries four,
 * all of them the handwritten line on the splash. React Native picks a face by
 * file rather than by numeric weight, so every weight in the design needs its
 * own entry - 500 in particular, which the design uses 387 times and the old
 * font config never declared.
 */
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or the module is unavailable in this environment. Neither
  // is worth failing a launch over.
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Caveat_400Regular,
  });

  useEffect(() => {
    // Hide on failure too. A font that will not load is a screen in the wrong
    // typeface; a splash that never lifts is an app that appears to be broken.
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
