/**
 * Cards, per the Penpot board "10 — Double-Bezel Cards".
 *
 * The design's one structural rule: an outer card holds inner panels. The outer
 * carries radius 14, a 1px Line border and the Card L shadow; an inner panel
 * carries radius 11, the same hairline, and *no* shadow. The board states the
 * failure mode explicitly — "never a shadow inside a shadow, or two tints
 * touching" — so `Card` and `Panel` are separate components and `Panel` has no
 * elevation prop to set.
 *
 * Padding is 16 outer, 12 inner.
 */
import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { color, elevation, radius, space } from "@/design/tokens";

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** A soft tint for alert cards. `none` is the default white surface. */
  tone?: "none" | "mint" | "red" | "amber" | "steel";
  style?: StyleProp<ViewStyle>;
  /** Drop the 16px padding when the card's content manages its own. */
  flush?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

const TONE_SURFACES: Record<NonNullable<CardProps["tone"]>, string> = {
  none: color.surfaceWhite,
  mint: color.mintSurface,
  red: color.redSoft,
  amber: color.amberSoft,
  steel: color.steelSoft,
};

export function Card({
  children,
  onPress,
  tone = "none",
  style,
  flush = false,
  testID,
  accessibilityLabel,
}: CardProps) {
  const content = (
    <View
      style={[
        styles.outer,
        { backgroundColor: TONE_SURFACES[tone] },
        // A tinted card reads as a surface in its own right; the hairline
        // border on top of a tint is the "two tints touching" the board warns
        // against, so it is dropped.
        tone === "none" ? styles.hairline : null,
        flush ? null : styles.outerPadding,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      {content}
    </Pressable>
  );
}

export interface PanelProps {
  children: React.ReactNode;
  tone?: CardProps["tone"];
  style?: StyleProp<ViewStyle>;
  flush?: boolean;
}

/** An inner panel. Radius 11, hairline, never a shadow. */
export function Panel({
  children,
  tone = "none",
  style,
  flush = false,
}: PanelProps) {
  return (
    <View
      style={[
        styles.inner,
        { backgroundColor: TONE_SURFACES[tone] },
        tone === "none" ? styles.hairline : null,
        flush ? null : styles.innerPadding,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * The mint icon plate that sits at the head of a KPI tile or panel.
 * 26–30px, radius 9, mint surface.
 */
export function IconPlate({
  children,
  size = 28,
  tone = "mint",
}: {
  children: React.ReactNode;
  size?: number;
  tone?: CardProps["tone"];
}) {
  return (
    <View
      style={[
        styles.plate,
        { width: size, height: size, backgroundColor: TONE_SURFACES[tone] },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: radius.listCard,
    ...elevation.cardL,
  },
  outerPadding: { padding: space.xl },
  inner: { borderRadius: 11 },
  innerPadding: { padding: space.md },
  hairline: { borderWidth: 1, borderColor: color.line },
  plate: {
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.94 },
});
