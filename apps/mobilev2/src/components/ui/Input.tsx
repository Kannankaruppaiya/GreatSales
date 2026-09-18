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
}

export function Input({
  label,
  hint,
  error,
  icon,
  trailing,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error ? color.red : focused ? color.primary : color.line;

  return (
    <View style={[styles.root, containerStyle]}>
      {label ? (
        <Text variant="caption" tone="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View style={[styles.field, { borderColor }]}>
        {icon ? <View style={styles.adornment}>{icon}</View> : null}
        <TextInput
          {...rest}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={color.muted2}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
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

const styles = StyleSheet.create({
  root: { gap: 6 },
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
