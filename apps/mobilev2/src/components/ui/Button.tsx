/**
 * Button, per the Penpot board "08 — Buttons".
 *
 * Variants: primary, secondary, tertiary, destructive, mint, ghost.
 * Sizes: hero 49 (the entry screens' gradient CTA, from "Screen 01A Login"),
 * large 46, medium 40, small 32 — all at least the 44px touch target
 * when they are the screen's main action. Labels are 13/700, Title Case.
 *
 * The board's rule "one primary action per screen" is a design rule, not one
 * this component can enforce; it is worth remembering when adding a second.
 */
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  color,
  control,
  elevation,
  font,
  radius,
  space,
} from "@/design/tokens";

import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { haptic } from "@/lib/haptics";

import { PressScale } from "./PressScale";
import { Text } from "./Text";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "destructive"
  | "mint"
  | "ghost";

export type ButtonSize = "hero" | "large" | "medium" | "small";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Rendered before the label, e.g. a Lucide icon at 18px. */
  icon?: React.ReactNode;
  /** Stretch to the container's width — the usual choice for a screen's CTA. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Hero only: the boards set the CTA label anywhere from 15 to 20. */
  labelSize?: number;
}

const HEIGHTS: Record<ButtonSize, number> = {
  hero: 49,
  large: control.heightLarge,
  medium: control.heightMedium,
  small: control.heightSmall,
};

interface VariantStyle {
  background: string;
  label: keyof typeof color;
  border?: string;
  shadow?: typeof elevation.primary | null;
}

const VARIANTS: Record<ButtonVariant, VariantStyle> = {
  primary: {
    background: color.primary,
    label: "surfaceWhite",
    shadow: elevation.primary,
  },
  secondary: {
    background: color.surfaceWhite,
    label: "primary",
    border: color.primary,
  },
  tertiary: { background: "transparent", label: "muted" },
  destructive: { background: color.red, label: "surfaceWhite" },
  mint: { background: color.mintSurface, label: "primaryDark" },
  ghost: { background: color.steelSoft, label: "steel" },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "large",
  disabled = false,
  loading = false,
  icon,
  block = false,
  style,
  testID,
  labelSize,
}: ButtonProps) {
  const spec = VARIANTS[variant];
  const height = HEIGHTS[size];
  const inactive = disabled || loading;

  return (
    <PressScale
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      disabled={inactive}
      onPress={
        onPress
          ? () => {
              if (variant === "primary" || variant === "destructive")
                haptic.light();
              onPress();
            }
          : undefined
      }
      style={[
        styles.base,
        {
          height,
          backgroundColor: spec.background,
          borderColor: spec.border ?? "transparent",
          borderWidth: spec.border ? 1 : 0,
          paddingHorizontal: size === "small" ? space.md : space.xl,
        },
        block && styles.block,
        size === "hero" ? styles.hero : null,
        spec.shadow && !inactive ? spec.shadow : null,
        inactive ? styles.inactive : null,
        style,
      ]}
    >
      {size === "hero" && variant === "primary" ? (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="btnHero" x1="0" y1="0.5" x2="1" y2="0.5">
              <Stop offset={0} stopColor={color.primaryDark} />
              <Stop offset={1} stopColor="#1BA560" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#btnHero)" />
        </Svg>
      ) : null}
      {loading ? (
        <ActivityIndicator size="small" color={color[spec.label]} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text
            style={[
              styles.label,
              size === "hero" ? styles.heroLabel : null,
              labelSize ? { fontSize: labelSize } : null,
              { color: color[spec.label] },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.input,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  block: { alignSelf: "stretch", width: "100%" },
  content: { flexDirection: "row", alignItems: "center", gap: space.sm },
  icon: { alignItems: "center", justifyContent: "center" },
  label: { fontFamily: font.bold, fontSize: 13 },
  hero: { borderRadius: 12, overflow: "hidden" },
  // The boards set 18 (01B) and 20 (01A); one size keeps the entry screens
  // consistent with each other.
  heroLabel: { fontSize: 18 },
  inactive: { opacity: 0.45 },
});
