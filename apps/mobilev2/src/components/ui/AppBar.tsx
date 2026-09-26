/**
 * Title bar, per the Penpot board "12 — Navigation Architecture".
 *
 * The design has two bars: the brand bar (home only, built into the Home
 * screen) and this one — back, centred title, at most one action. The "at most
 * one" is the design's rule and the reason `action` is a single node rather
 * than a list.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";

import { color, icon, space } from "@/design/tokens";

import { Text } from "./Text";

export interface AppBarProps {
  title: string;
  subtitle?: string;
  /** Hidden on a screen that is the root of its stack. */
  showBack?: boolean;
  onBack?: () => void;
  action?: React.ReactNode;
}

export function AppBar({
  title,
  subtitle,
  showBack = true,
  onBack,
  action,
}: AppBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            // A screen opened from a notification or a reloaded web tab has
            // nothing behind it; going "back" then means going home.
            onPress={
              onBack ??
              (() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace("/(tabs)/home"))
            }
            hitSlop={12}
          >
            <ChevronLeft
              // Every screen board draws back as a chevron, 27px.
              size={27}
              color={color.ink}
              strokeWidth={icon.strokeWidth}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.titleBlock}>
        <Text variant="pageTitle" align="center" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" align="center" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={[styles.side, styles.sideRight]}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.gutter,
    paddingBottom: space.md,
    backgroundColor: color.canvas,
  },
  // Equal side columns keep the title optically centred whatever they hold.
  side: { width: 44, justifyContent: "center" },
  sideRight: { alignItems: "flex-end" },
  titleBlock: { flex: 1, gap: 2 },
});
