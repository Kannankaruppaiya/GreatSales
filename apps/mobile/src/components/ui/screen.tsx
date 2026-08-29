/**
 * Screen — the standard page container. Handles safe areas, the app background,
 * status-bar style, keyboard avoidance and (optionally) scrolling so individual
 * screens don't re-solve these every time.
 *
 * Use `scroll` for content that can exceed the viewport or sits above the
 * keyboard (forms). Use the default (non-scroll) for fixed layouts.
 */
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  /** Safe-area edges to pad. Bottom is excluded by default (tab bar owns it). */
  edges?: Edge[];
  /** Horizontal padding applied to content. */
  padded?: boolean;
  contentStyle?: ViewStyle;
  /** Center content vertically (useful for empty/auth screens). */
  center?: boolean;
  /** Pull-to-refresh (scroll mode only). */
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function Screen({
  children,
  scroll = false,
  edges = ['top', 'left', 'right'],
  padded = true,
  contentStyle,
  center = false,
  refreshing,
  onRefresh,
}: ScreenProps) {
  const { colors, scheme, spacing } = useTheme();

  const padding: ViewStyle = padded ? { paddingHorizontal: spacing.lg } : {};

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        padding,
        { paddingVertical: spacing.lg, flexGrow: 1 },
        center && styles.center,
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding, { paddingVertical: spacing.lg }, center && styles.center, contentStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={edges}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: 'center' },
});
