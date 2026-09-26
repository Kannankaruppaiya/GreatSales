/**
 * The page shell every screen sits in.
 *
 * Owns the canvas colour, the 18px screen gutter from the spacing board, and
 * the safe-area insets. Screens do not set their own background or padding, so
 * the gutter is the same on all ~101 of them.
 */
import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, nav, space } from "@/design/tokens";
import { describeError } from "@/data/http";

import { Panel } from "./Card";
import { Text } from "./Text";

export interface ScreenProps {
  children: React.ReactNode;
  /** Scrolling is the default; pass false for a screen that owns a FlatList. */
  scroll?: boolean;
  /** Drop the horizontal gutter for full-bleed content such as a map or list. */
  bleed?: boolean;
  /** Leave room for the bottom navigation bar. */
  tabBarSpacing?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /**
   * The screen's last load failure. Shown as a banner above the content, so a
   * request that failed never reads as an empty list — "no customers" and
   * "could not reach the server" are different claims.
   */
  error?: Error | null;
  /** Retry for `error`; defaults to `onRefresh`. */
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Screen({
  children,
  scroll = true,
  bleed = false,
  tabBarSpacing = true,
  onRefresh,
  refreshing = false,
  error,
  onRetry,
  style,
  testID,
}: ScreenProps) {
  const retry = onRetry ?? onRefresh;
  const banner = error ? (
    <Panel tone="red" style={styles.error}>
      <Text variant="caption" tone="redDark">
        {describeError(error)}
      </Text>
      {retry ? (
        <Text
          variant="caption"
          tone="redDark"
          style={styles.retry}
          onPress={retry}
          accessibilityRole="button"
        >
          Try again
        </Text>
      ) : null}
    </Panel>
  ) : null;
  const insets = useSafeAreaInsets();

  // The FAB is raised above the bar, so the bar's height alone is not enough
  // clearance for the last row of a list.
  const bottomPad = tabBarSpacing
    ? nav.barHeight + nav.fabRaise + insets.bottom
    : insets.bottom;

  const padding = {
    paddingHorizontal: bleed ? 0 : space.gutter,
    paddingBottom: bottomPad,
  };

  if (!scroll) {
    return (
      <View testID={testID} style={[styles.root, padding, style]}>
        {banner}
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      testID={testID}
      style={styles.root}
      contentContainerStyle={[padding, style]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={color.primary}
            colors={[color.primary]}
          />
        ) : undefined
      }
    >
      {banner}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  error: { marginVertical: space.sm, gap: space.xs },
  retry: { fontWeight: "700", textDecorationLine: "underline" },
});
