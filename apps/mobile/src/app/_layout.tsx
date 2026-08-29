/**
 * Root layout: installs the app-wide providers (gestures, safe areas, theme,
 * auth) and gates rendering on session bootstrap so we never flash the wrong
 * screen. While the stored session is being restored we hold a branded splash;
 * once resolved, expo-router routes to `(app)` or `sign-in` (each group's
 * layout enforces the actual guard).
 */
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { navTheme } from '@/theme/navigation';
import { ThemeProvider as TokenThemeProvider, useTheme } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

function BrandedSplash() {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.splash, { backgroundColor: colors.bg, gap: spacing.lg }]}>
      <Text variant="display" color="link">
        GreatSales
      </Text>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function RootNavigator() {
  const { scheme } = useTheme();
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return <BrandedSplash />;

  return (
    <ThemeProvider value={navTheme(scheme)}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="sign-in" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <TokenThemeProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </TokenThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
