/**
 * Chips and badges, per the Penpot board "15 — Status Chips & Badges".
 *
 * Label 10/700, fully rounded, soft tint background with saturated text, icon
 * only when it adds meaning. The board sets the colour semantics, and they are
 * encoded here so a screen cannot pick "red because it looks urgent":
 *
 *   amber = act now · steel = waiting on them · mint = on track
 *   red   = genuinely overdue, and nothing else
 *
 * A chip with `onPress` is a filter or choice pill instead, as every list
 * board draws them (02B.1, 02C.1, 03A.1): 34 tall, white with a hairline, a
 * 13/700 ink label and a 13/800 count in the tone's colour; solid green with
 * a soft shadow when active.
 */
import React from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { color, font, radius, space } from "@/design/tokens";

import { PressScale } from "./PressScale";
import { Text } from "./Text";

export type ChipTone = "mint" | "amber" | "red" | "steel" | "neutral";

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  icon?: React.ReactNode;
  onPress?: () => void;
  /** Filter chips use the active state; status chips do not. */
  active?: boolean;
  /** A count rendered after the label, as on the segmented filter chips. */
  count?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const TONES: Record<ChipTone, { bg: string; fg: keyof typeof color }> = {
  mint: { bg: color.mintSurface, fg: "primaryDark" },
  amber: { bg: color.amberSoft, fg: "amber" },
  red: { bg: color.redSoft, fg: "redDark" },
  steel: { bg: color.steelSoft, fg: "steel" },
  neutral: { bg: color.lineSoft, fg: "muted" },
};

export function Chip({
  label,
  tone = "neutral",
  icon,
  onPress,
  active = false,
  count,
  style,
  testID,
}: ChipProps) {
  const spec = TONES[tone];
  // An active filter chip inverts: solid primary with white text, which is the
  // one place a chip is not a soft tint.
  const background = active ? color.primary : spec.bg;
  const foreground = active ? color.surfaceWhite : color[spec.fg];

  const body = (
    <View style={[styles.chip, { backgroundColor: background }, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
      {count != null ? (
        <Text style={[styles.count, { color: foreground }]}>{count}</Text>
      ) : null}
    </View>
  );

  if (!onPress) return body;

  const countColour =
    tone === "red"
      ? color.red
      : tone === "neutral"
        ? color.muted
        : color.primary;

  return (
    <PressScale
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      // 34 tall; the hit slop brings it up to the 44px touch target.
      hitSlop={5}
      scaleTo={0.95}
      style={[styles.pill, active ? styles.pillActive : styles.pillIdle, style]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          styles.pillLabel,
          { color: active ? color.surfaceWhite : color.ink },
        ]}
      >
        {label}
      </Text>
      {count != null ? (
        <Text
          style={[
            styles.pillCount,
            { color: active ? color.surfaceWhite : countColour },
          ]}
        >
          {count}
        </Text>
      ) : null}
    </PressScale>
  );
}

/** The count badge that sits on the bell. Never rendered alone. */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

/**
 * A due-state dot: overdue, due, scheduled.
 *
 * Takes the tone's saturated colour, not its tint — a 7px dot in a soft tint is
 * invisible against the card it sits on.
 */
export function StatusDot({ tone }: { tone: ChipTone }) {
  return (
    <View style={[styles.dot, { backgroundColor: color[TONES[tone].fg] }]} />
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  icon: { alignItems: "center", justifyContent: "center" },
  pill: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 17,
    paddingHorizontal: 16,
  },
  pillIdle: {
    backgroundColor: color.surfaceWhite,
    borderWidth: 1,
    borderColor: color.line,
  },
  pillActive: {
    backgroundColor: color.primary,
    boxShadow: "0px 2px 8px 0px rgba(14,122,74,0.28)",
  },
  pillLabel: { fontFamily: font.bold, fontSize: 13 },
  pillCount: { fontFamily: font.extrabold, fontSize: 13 },
  label: { fontFamily: font.bold, fontSize: 10 },
  count: { fontFamily: font.extrabold, fontSize: 10, opacity: 0.8 },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: color.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: font.bold, fontSize: 9, color: color.surfaceWhite },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
});
