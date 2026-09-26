/**
 * The search field that heads the list screens.
 *
 * A filled field rather than the bordered Input: the design uses it as a
 * surface on the canvas, not as a form control inside a card. Sizes are the
 * list boards' (02C.1, 03A.1): 42 tall, radius 13, #EFF5F8 fill, 14/500 text.
 */
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Search, X } from "lucide-react-native";

import { PressScale } from "./PressScale";
import { Text } from "./Text";

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

/** The square sort / filter button the boards put beside the search field. */
export function SearchBarButton({
  accessibilityLabel,
  onPress,
  children,
  badge,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  children: React.ReactNode;
  /** How many filters are applied; a green count on the corner when > 0. */
  badge?: number;
}) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scaleTo={0.92}
      style={styles.button}
    >
      {children}
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </PressScale>
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
    borderRadius: 13,
    backgroundColor: "#EFF5F8",
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.md,
  },
  input: { flex: 1, fontFamily: font.medium, fontSize: 14, color: color.ink },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: font.bold, fontSize: 10, color: color.surfaceWhite },
  button: {
    width: 39,
    height: 42,
    borderRadius: 13,
    backgroundColor: color.surfaceWhite,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: "center",
    justifyContent: "center",
  },
});
