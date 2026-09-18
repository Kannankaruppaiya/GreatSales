/**
 * Initials avatar.
 *
 * The design uses a tinted circle with the account's initials rather than a
 * photo for customers — there are no customer photographs in this product, and
 * a placeholder face would be inventing one.
 */
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { color, font, radius } from "@/design/tokens";

import { Text } from "./Text";

/** Tints the avatar deterministically from the name, so a customer's colour never moves. */
const PALETTE = [
  { bg: color.mintSurface, fg: color.primaryDark },
  { bg: color.steelSoft, fg: color.steel },
  { bg: color.amberSoft, fg: color.amber },
  { bg: color.lineSoft, fg: color.muted },
] as const;

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}

function paletteFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1)
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

export interface AvatarProps {
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ name, size = 38, style }: AvatarProps) {
  const tint = paletteFor(name);
  return (
    <View
      accessible
      accessibilityLabel={name}
      style={[
        styles.root,
        {
          width: size,
          height: size,
          backgroundColor: tint.bg,
          borderRadius: radius.pill,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.initials,
          { color: tint.fg, fontSize: Math.round(size * 0.34) },
        ]}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: font.bold },
});
