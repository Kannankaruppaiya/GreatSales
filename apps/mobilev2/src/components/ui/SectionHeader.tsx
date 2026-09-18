/**
 * A section heading with an optional trailing link, as on the home screen
 * ("Today's Focus … View All ›").
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { color, icon, space } from "@/design/tokens";

import { Text } from "./Text";

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text variant="section">{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}, ${title}`}
          onPress={onAction}
          hitSlop={10}
          style={styles.action}
        >
          <Text variant="secondary" tone="primary">
            {actionLabel}
          </Text>
          <ChevronRight size={14} color={color.primary} strokeWidth={icon.strokeWidth} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.md,
  },
  action: { flexDirection: "row", alignItems: "center", gap: 2 },
});
