/**
 * Back / continue buttons pinned under a wizard step.
 *
 * `nextDisabled` exists so a step can refuse to advance without the field
 * itself having to disappear — the person can see what is missing.
 */
import React from "react";
import { StyleSheet, View } from "react-native";

import { space } from "@/design/tokens";

import { Button } from "../ui/Button";

export interface StepFooterProps {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
}

export function StepFooter({
  onBack,
  onNext,
  nextLabel = "Continue",
  backLabel = "Back",
  nextDisabled,
  busy,
}: StepFooterProps) {
  return (
    <View style={styles.root}>
      {onBack ? (
        <Button
          label={backLabel}
          variant="secondary"
          style={styles.back}
          onPress={onBack}
        />
      ) : null}
      <Button
        label={busy ? "Working…" : nextLabel}
        style={styles.next}
        disabled={nextDisabled || busy}
        onPress={onNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", gap: space.md, marginTop: space.xxl },
  back: { flex: 1 },
  next: { flex: 1.4 },
});
