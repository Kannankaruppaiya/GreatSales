/**
 * Chips and badges, per the Penpot board "15 — Status Chips & Badges".
 *
 * Label 10/700, fully rounded, soft tint background with saturated text, icon
 * only when it adds meaning. The board sets the colour semantics, and they are
 * encoded here so a screen cannot pick "red because it looks urgent":
 *
 *   amber = act now · steel = waiting on them · mint = on track
 *   red   = genuinely overdue, and nothing else
 */
import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { color, font, radius, space } from "@/design/tokens";

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

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      // The chip itself is short; the hit slop brings it up to the 44px target
      // the buttons board requires without changing how it looks.
      hitSlop={8}
    >
      {body}
    </Pressable>
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
