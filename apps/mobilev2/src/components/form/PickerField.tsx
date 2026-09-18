/**
 * A labelled row that opens a sheet and shows what was chosen.
 *
 * Used for every fixed-set choice in the create flows — payment terms, stage,
 * status, category — and for the date and time rows, which pass their own
 * sheet as `onPress`. A row with nothing chosen shows its placeholder in the
 * muted tone, so "not set yet" and "set to something" never look alike.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronDown } from "lucide-react-native";

import { Text } from "../ui/Text";
import { color, control, radius, space } from "@/design/tokens";

export interface PickerFieldProps {
  label?: string;
  /** What was chosen. `null` shows `placeholder` instead. */
  value: string | null;
  placeholder: string;
  onPress: () => void;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
  disabled?: boolean;
}

export function PickerField({
  label,
  value,
  placeholder,
  onPress,
  icon,
  error,
  hint,
  disabled,
}: PickerFieldProps) {
  return (
    <View style={styles.root}>
      {label ? (
        <Text variant="caption" tone="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={`${label ?? placeholder}${value ? `, ${value}` : ", not set"}`}
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.field,
          { borderColor: error ? color.red : color.line },
          disabled ? styles.fieldDisabled : null,
        ]}
      >
        {icon ? <View style={styles.adornment}>{icon}</View> : null}
        <Text
          variant="body"
          tone={value ? "ink" : "faint"}
          numberOfLines={1}
          style={styles.value}
        >
          {value ?? placeholder}
        </Text>
        {!disabled ? (
          <ChevronDown size={16} color={color.muted2} strokeWidth={2} />
        ) : null}
      </Pressable>

      {error || hint ? (
        <Text
          variant="nano"
          tone={error ? "red" : "muted2"}
          style={styles.hint}
        >
          {error ?? hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  label: {},
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: control.heightLarge,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderRadius: radius.input,
    backgroundColor: color.lineSoft,
  },
  fieldDisabled: { opacity: 0.6 },
  adornment: {},
  value: { flex: 1 },
  hint: {},
});
