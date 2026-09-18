/**
 * Says, on screen, that the rows below are generated.
 *
 * The brief's hard requirement is that this app never passes invented figures
 * off as the tenant's data. The synthetic source exists so screens can be built
 * before the API is wired, and this banner is the other half of that bargain:
 * while it is visible, nothing on screen is a real customer, order or amount.
 *
 * It renders only when the active source is synthetic, so it disappears of its
 * own accord the moment the app is pointed at the API.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { FlaskConical } from "lucide-react-native";

import { color, radius, space } from "@/design/tokens";
import { useIsSynthetic } from "@/data/provider";

import { Text } from "./Text";

export function SyntheticBanner() {
  const synthetic = useIsSynthetic();
  if (!synthetic) return null;

  return (
    <View style={styles.root} accessibilityRole="alert">
      <FlaskConical size={14} color={color.steel} strokeWidth={2} />
      <Text variant="caption" tone="steel" style={styles.label}>
        Sample data — nothing here is a real customer or amount.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.steelSoft,
    borderRadius: radius.tile,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginTop: space.sm,
  },
  label: { flex: 1 },
});
