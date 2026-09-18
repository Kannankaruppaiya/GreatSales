/**
 * 03A.3 — the "Sorted by:" control on the pipeline list, and the sheet behind
 * it.
 *
 * The board shows "Expected Close (Soonest)" with a chevron; these are the
 * orders the data source can actually honour. "Probability" is not among them:
 * it is derived from the stage, so sorting by it would just be a stage sort
 * with a misleading name.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Text } from "@/components/ui/Text";
import { color, space } from "@/design/tokens";

export type LeadSort = "value" | "closeDate" | "recent";

export const SORT_LABELS: Record<LeadSort, string> = {
  closeDate: "Expected Close (Soonest)",
  value: "Deal Value (Highest)",
  recent: "Recently Updated",
};

const ORDER: LeadSort[] = ["closeDate", "value", "recent"];

export interface SortSheetProps {
  visible: boolean;
  onClose: () => void;
  value: LeadSort;
  onChange: (next: LeadSort) => void;
}

export function SortSheet({
  visible,
  onClose,
  value,
  onChange,
}: SortSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Sort by">
      {ORDER.map((sort) => {
        const selected = sort === value;
        return (
          <Pressable
            key={sort}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => {
              onChange(sort);
              onClose();
            }}
            style={styles.row}
          >
            <Text variant="body" style={styles.label}>
              {SORT_LABELS[sort]}
            </Text>
            {selected ? (
              <Check size={17} color={color.primary} strokeWidth={2.5} />
            ) : null}
          </Pressable>
        );
      })}
      <View style={styles.tail} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: space.md,
  },
  label: { flex: 1 },
  tail: { height: space.sm },
});
