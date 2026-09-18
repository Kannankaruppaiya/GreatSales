/**
 * Half-hour slots across the working day, for choosing a follow-up time.
 *
 * A free-typed time is a validation problem for no benefit — every follow-up
 * this app schedules lands on a slot a person would actually say out loud.
 * The range covers 07:00 to 20:30, which is wider than a field day.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { BottomSheet } from "../ui/BottomSheet";
import { Text } from "../ui/Text";
import { color, space } from "@/design/tokens";

const START_HOUR = 7;
const END_HOUR = 21;

/** `"HH:MM"` in 24-hour form, which is what the value is stored as. */
export const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = START_HOUR; h < END_HOUR; h += 1) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

export function formatSlot(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const hour = h ?? 0;
  const suffix = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

export interface TimePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  value: string | null;
  onChange: (next: string) => void;
  title?: string;
}

export function TimePickerSheet({
  visible,
  onClose,
  value,
  onChange,
  title = "Pick a time",
}: TimePickerSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.list}>
        {TIME_SLOTS.map((slot) => {
          const selected = slot === value;
          return (
            <Pressable
              key={slot}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => {
                onChange(slot);
                onClose();
              }}
              style={styles.row}
            >
              <Text variant="body" style={styles.label}>
                {formatSlot(slot)}
              </Text>
              {selected ? (
                <Check size={17} color={color.primary} strokeWidth={2.5} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    gap: space.md,
  },
  label: { flex: 1 },
});
