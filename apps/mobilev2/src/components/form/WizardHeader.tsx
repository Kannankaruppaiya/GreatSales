/**
 * The step indicator above a multi-step create flow.
 *
 * Flows 04, 05L–O, 06B–G and 08D–J are all described in the spec as a sequence
 * of screens. They are built as one route with steps instead, so a half-filled
 * form survives a back press and the review step can still reach every answer.
 * This is what tells the person where they are in that sequence.
 */
import React from "react";
import { StyleSheet, View } from "react-native";

import { color, radius, space } from "@/design/tokens";

import { Text } from "../ui/Text";

export interface WizardHeaderProps {
  steps: string[];
  /** Zero-based. */
  current: number;
}

export function WizardHeader({ steps, current }: WizardHeaderProps) {
  const safe = Math.min(Math.max(current, 0), steps.length - 1);

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        {steps.map((step, index) => (
          <View
            key={step}
            style={[
              styles.segment,
              index <= safe ? styles.segmentDone : null,
              /* The bar reads left to right, so only the reached segments fill. */
            ]}
          />
        ))}
      </View>
      <Text variant="caption" tone="muted">
        Step {safe + 1} of {steps.length} · {steps[safe]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm, paddingBottom: space.lg },
  bar: { flexDirection: "row", gap: space.xs },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.lineSoft,
  },
  segmentDone: { backgroundColor: color.primary },
});
