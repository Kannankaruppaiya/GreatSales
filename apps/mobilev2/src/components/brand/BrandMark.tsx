/**
 * Brand lockup, per the Penpot board "01 — Brand Assets".
 *
 * The rules the board states, encoded so they cannot drift:
 *  - App mark: rounded square, radius 26% of its size, minimum 40px.
 *  - Wordmark: the G is always Primary, the remainder Ink.
 *  - The sub-line locks to the wordmark's left edge.
 *  - Caveat is the brand script and is never used for UI text.
 *
 * Drawn in code rather than shipped as a bitmap: the mark is a letter in a
 * rounded square, so exporting it as a PNG would only cost resolution.
 */
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { color, font, type } from "@/design/tokens";

import { Text } from "../ui/Text";

const MIN_MARK_SIZE = 40;

export function AppMark({ size = MIN_MARK_SIZE }: { size?: number }) {
  const resolved = Math.max(size, MIN_MARK_SIZE);
  return (
    <View
      accessible
      accessibilityLabel="GreatSales"
      style={[
        styles.mark,
        {
          width: resolved,
          height: resolved,
          // Radius is 26% of the size, per the board.
          borderRadius: resolved * 0.26,
        },
      ]}
    >
      <Text
        style={[styles.markLetter, { fontSize: Math.round(resolved * 0.52) }]}
      >
        G
      </Text>
    </View>
  );
}

export interface WordmarkProps {
  /** The in-app lockup is 20/10; the splash uses a larger pairing. */
  size?: "app" | "large";
  showSubline?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Wordmark({
  size = "app",
  showSubline = true,
  style,
}: WordmarkProps) {
  const titleSize = size === "large" ? 30 : 20;
  const subSize = size === "large" ? 12 : 10;

  return (
    <View
      accessible
      accessibilityLabel="GreatSales, Field Sales CRM"
      style={style}
    >
      <Text style={[styles.wordmark, { fontSize: titleSize }]}>
        <Text
          style={[
            styles.wordmark,
            { fontSize: titleSize, color: color.primary },
          ]}
        >
          G
        </Text>
        reatSales
      </Text>
      {showSubline ? (
        <Text style={[styles.subline, { fontSize: subSize }]}>
          Field Sales CRM
        </Text>
      ) : null}
    </View>
  );
}

/** The brand script. Caveat only, and never for UI text. */
export function BrandScript({ children }: { children: string }) {
  return <Text style={styles.script}>{children}</Text>;
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  markLetter: { fontFamily: font.extrabold, color: color.surfaceWhite },
  wordmark: { fontFamily: font.bold, color: color.ink },
  // Locks to the wordmark's left edge — no indent.
  subline: { fontFamily: font.medium, color: color.muted, marginTop: -1 },
  script: { ...type.script, color: color.muted },
});
