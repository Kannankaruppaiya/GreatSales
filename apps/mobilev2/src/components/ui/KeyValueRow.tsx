/**
 * A label-left, value-right row, as the detail screens use throughout.
 *
 * The design sets the label at 13/500 Muted and the value at 13/600 Ink,
 * right-aligned, with the value free to wrap onto a second line. A value node
 * can be passed instead of text when it is a chip or a pill.
 */
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { color, font, space } from "@/design/tokens";

import { Text } from "./Text";

export interface KeyValueRowProps {
  label: string;
  value?: string | null;
  /** Rendered in place of `value` — a chip, a pill, a link. */
  children?: React.ReactNode;
  /** Shown when `value` is null or empty, so a blank cell never appears. */
  emptyText?: string;
  style?: StyleProp<ViewStyle>;
}

export function KeyValueRow({
  label,
  value,
  children,
  emptyText = "Not set",
  style,
}: KeyValueRowProps) {
  return (
    <View style={[styles.row, style]}>
      <Text variant="body" tone="muted" style={styles.label}>
        {label}
      </Text>
      <View style={styles.value}>
        {children ?? (
          <Text style={styles.valueText} align="right">
            {value && value.length > 0 ? value : emptyText}
          </Text>
        )}
      </View>
    </View>
  );
}

/** A hairline between rows in a detail list. */
export function RowDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.md,
  },
  label: { flex: 1 },
  value: { flex: 1.3, alignItems: "flex-end" },
  valueText: { fontFamily: font.semibold, fontSize: 13, color: color.ink },
  divider: { height: 1, backgroundColor: color.lineSoft },
});
