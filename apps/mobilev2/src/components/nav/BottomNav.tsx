/**
 * The bottom navigation, per the Penpot board "12 — Navigation Architecture".
 *
 * Home | Pipeline | + | Customers | More. Bar 52, icons 21, labels 10, FAB 53
 * raised 17. The board is emphatic that the + is a global create launcher and
 * "not a second navigator", so it is not a tab: it opens a sheet and the
 * selected tab does not change.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, LayoutGrid, Plus, Users, Ellipsis } from "lucide-react-native";

import { color, elevation, font, nav, radius } from "@/design/tokens";

import { Text } from "../ui/Text";

export type TabKey = "home" | "pipeline" | "customers" | "more";

export interface BottomNavProps {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
  /** Opens the Quick Actions sheet. Never changes the active tab. */
  onCreate: () => void;
}

const LEFT_TABS = [
  { key: "home" as const, label: "Home", Icon: Home },
  { key: "pipeline" as const, label: "Pipeline", Icon: LayoutGrid },
];

const RIGHT_TABS = [
  { key: "customers" as const, label: "Customers", Icon: Users },
  { key: "more" as const, label: "More", Icon: Ellipsis },
];

function Tab({
  label,
  Icon,
  active,
  onPress,
}: {
  label: string;
  Icon: typeof Home;
  active: boolean;
  onPress: () => void;
}) {
  const tint = active ? color.primary : color.muted2;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.tab}
    >
      <Icon size={nav.iconSize} color={tint} strokeWidth={2} />
      <Text style={[styles.tabLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function BottomNav({ active, onSelect, onCreate }: BottomNavProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.bar}>
        {LEFT_TABS.map((tab) => (
          <Tab
            key={tab.key}
            label={tab.label}
            Icon={tab.Icon}
            active={active === tab.key}
            onPress={() => onSelect(tab.key)}
          />
        ))}

        {/* The FAB's footprint in the bar, so the tabs space evenly around it. */}
        <View style={styles.fabSlot} />

        {RIGHT_TABS.map((tab) => (
          <Tab
            key={tab.key}
            label={tab.label}
            Icon={tab.Icon}
            active={active === tab.key}
            onPress={() => onSelect(tab.key)}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create"
        accessibilityHint="Opens new lead, customer, order and follow-up"
        onPress={onCreate}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + nav.fabRaise },
          pressed ? styles.fabPressed : null,
        ]}
      >
        <Plus size={26} color={color.surfaceWhite} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.surfaceWhite,
    ...elevation.nav,
  },
  bar: {
    height: nav.barHeight,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: color.lineSoft,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  tabLabel: { fontFamily: font.bold, fontSize: nav.labelSize },
  fabSlot: { width: nav.fabSize + 16 },
  fab: {
    position: "absolute",
    alignSelf: "center",
    width: nav.fabSize,
    height: nav.fabSize,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: color.surfaceWhite,
    ...elevation.fab,
  },
  fabPressed: { opacity: 0.92 },
});
