/**
 * The search field that heads the list screens.
 *
 * A filled pill rather than the bordered Input: the design uses it as a surface
 * on the canvas, not as a form control inside a card.
 */
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Search, X } from "lucide-react-native";

import { color, font, icon, radius, space } from "@/design/tokens";

export interface SearchBarProps {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  /** Rendered after the field — usually the filter button. */
  trailing?: React.ReactNode;
  autoFocus?: boolean;
  testID?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search",
  trailing,
  autoFocus = false,
  testID,
}: SearchBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <Search size={18} color={color.muted2} strokeWidth={icon.strokeWidth} />
        <TextInput
          testID={testID}
          accessibilityLabel={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.muted2}
          autoFocus={autoFocus}
          returnKeyType="search"
          style={styles.input}
        />
        {value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => onChangeText("")}
            hitSlop={10}
          >
            <X size={16} color={color.muted} strokeWidth={icon.strokeWidth} />
          </Pressable>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 42,
    borderRadius: radius.input,
    backgroundColor: color.surfaceWhite,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.md,
  },
  input: { flex: 1, fontFamily: font.medium, fontSize: 13, color: color.ink },
});
