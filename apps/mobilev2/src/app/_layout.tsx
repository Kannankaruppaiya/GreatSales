/**
 * Root layout: fonts, safe area, data source, and the signed-in shell.
 *
 * The splash is held until the fonts load, because the whole design is set in
 * Plus Jakarta Sans and a first paint in the system font is a visibly different
 * app for the half-second it lasts.
 */
// First, before anything else: importing this initialises Sentry, so an error
// thrown while the first screen is still mounting is caught too.
import { Sentry } from "@/lib/observability";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Caveat_400Regular } from "@expo-google-fonts/caveat";

import { AppShell } from "@/components/nav/AppShell";
import { color } from "@/design/tokens";
import { DataProvider } from "@/data/provider";
import { PreferencesProvider } from "@/lib/preferences";

void SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Caveat_400Regular,
  });

  useEffect(() => {
    // Hide on error too: a missing font should degrade to the system face, not
    // leave the user staring at the splash.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DataProvider>
          <PreferencesProvider>
            <StatusBar style="dark" />
            <AppShell>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: color.canvas },
                }}
              />
            </AppShell>
          </PreferencesProvider>
        </DataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap puts an error boundary around the whole tree and ties crash
// reports to the navigation that led to them.
export default Sentry.wrap(RootLayout);
