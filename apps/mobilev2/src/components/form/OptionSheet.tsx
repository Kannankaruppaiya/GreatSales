/**
 * A short list of fixed choices in a sheet — payment terms, status, category.
 *
 * Distinct from `EntityPickerSheet` because there is nothing to search: the
 * options are an enum the app already knows, so adding a search field would be
 * a control that never helps.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { BottomSheet } from "../ui/BottomSheet";
import { Text } from "../ui/Text";
import { color, space } from "@/design/tokens";

export interface OptionSheetProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (next: T) => void;
  /** Adds a row that clears the choice. */
  clearLabel?: string;
  onClear?: () => void;
}

export function OptionSheet<T extends string>({
  visible,
  onClose,
  title,
  options,
  value,
  onChange,
  clearLabel,
  onClear,
}: OptionSheetProps<T>) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.list}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => {
                onChange(option.value);
                onClose();
              }}
              style={styles.row}
            >
              <View style={styles.rowText}>
                <Text variant="body">{option.label}</Text>
                {option.hint ? (
                  <Text variant="caption" tone="muted">
                    {option.hint}
                  </Text>
                ) : null}
              </View>
              {selected ? <Check size={17} color={color.primary} strokeWidth={2.5} /> : null}
            </Pressable>
          );
        })}

        {onClear && clearLabel ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onClear();
              onClose();
            }}
            style={styles.row}
          >
            <Text variant="body" tone="muted" style={styles.rowText}>
              {clearLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: space.md },
  row: { flexDirection: "row", alignItems: "center", minHeight: 48, gap: space.md },
  rowText: { flex: 1, gap: 2 },
});
