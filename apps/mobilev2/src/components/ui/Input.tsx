/**
 * Text field, per the Penpot board "09 — Inputs & Form Controls".
 *
 * Radius 10, hairline border, Line Soft fill; the border turns Primary on focus
 * and Red when the field carries an error. The label sits above the field and
 * the error replaces the hint below it, so the row height does not change when
 * validation fires.
 */
import React, { useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { color, control, font, radius, space } from "@/design/tokens";

import { Text } from "./Text";

export interface InputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  /** Shown under the field, and replaced by `error` when there is one. */
  hint?: string;
  error?: string;
  /** Rendered inside the field, before the text. */
  icon?: React.ReactNode;
  /** Rendered inside the field, after the text — a unit, or a clear button. */
  trailing?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * `large` is the entry-screen field from the Penpot board "Screen 01A
   * Login": 49 tall, radius 12, a 14/600 ink label and 15px text. Everything
   * inside the app uses the default 44px field from "09 — Inputs".
   */
  size?: "default" | "large";
}

export function Input({
  label,
  hint,
  error,
  icon,
  trailing,
  containerStyle,
  size = "default",
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);

  const large = size === "large";
  const borderColor = error
    ? color.red
    : focused
      ? color.primary
      : large
        ? LARGE_IDLE_BORDER
        : color.line;

  return (
    <View style={[styles.root, containerStyle]}>
      {label ? (
        <Text
          variant="caption"
          tone={large ? "ink" : "muted"}
          style={[styles.label, large ? styles.labelLarge : null]}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[styles.field, large ? styles.fieldLarge : null, { borderColor }]}
      >
        {icon ? <View style={styles.adornment}>{icon}</View> : null}
        <TextInput
          {...rest}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={large ? LARGE_PLACEHOLDER : color.muted2}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, large ? styles.inputLarge : null]}
        />
        {trailing ? <View style={styles.adornment}>{trailing}</View> : null}
      </View>

      {error ? (
        <Text variant="caption" tone="red" style={styles.help}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted2" style={styles.help}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// The login board's own hairline and placeholder, a shade cooler than the
// in-app field's.
const LARGE_IDLE_BORDER = "#DFE8ED";
const LARGE_PLACEHOLDER = "#9CB2BD";

const styles = StyleSheet.create({
  root: { gap: 6 },
  labelLarge: { fontFamily: font.semibold, fontSize: 14, marginBottom: 4 },
  fieldLarge: { minHeight: 49, borderRadius: 12, paddingHorizontal: 17 },
  inputLarge: { fontFamily: font.regular, fontSize: 15 },
  label: { marginLeft: 2 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: control.minTouchTarget,
    borderRadius: radius.input,
    borderWidth: 1,
    backgroundColor: color.surfaceWhite,
    paddingHorizontal: space.md,
  },
  input: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: 13,
    color: color.ink,
    paddingVertical: space.md,
  },
  adornment: { alignItems: "center", justifyContent: "center" },
  help: { marginLeft: 2 },
});
