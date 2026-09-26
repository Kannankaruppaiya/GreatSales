/**
 * Button, per the Penpot board "08 — Buttons".
 *
 * Variants: primary, secondary, tertiary, destructive, mint, ghost.
 * Sizes: large 46, medium 40, small 32 — all at least the 44px touch target
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

export type ButtonSize = "large" | "medium" | "small";

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
}

const HEIGHTS: Record<ButtonSize, number> = {
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
        spec.shadow && !inactive ? spec.shadow : null,
        inactive ? styles.inactive : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color[spec.label]} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[styles.label, { color: color[spec.label] }]}>
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
  inactive: { opacity: 0.45 },
});
