/**
 * The Quick Actions launcher behind the +, per the Penpot board "13 — Bottom
 * Sheets & Quick Action Launcher".
 *
 * Four core actions only, as the navigation board specifies. Adding a fifth is
 * how the + turns into the second navigator the design says it must not be.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarPlus,
  ShoppingCart,
  UserPlus,
  Target,
  X,
} from "lucide-react-native";

import { color, elevation, font, radius, space } from "@/design/tokens";

import { PressScale } from "../ui/PressScale";
import { SheetModal } from "../ui/SheetModal";
import { Text } from "../ui/Text";

interface Action {
  key: string;
  label: string;
  hint: string;
  href: string;
  Icon: typeof UserPlus;
}

const ACTIONS: Action[] = [
  {
    key: "lead",
    label: "New Sales Lead",
    hint: "Add a new lead to your pipeline",
    href: "/lead/new",
    Icon: Target,
  },
  {
    key: "customer",
    label: "Add Customer",
    hint: "Create a new customer record",
    href: "/customer/new",
    Icon: UserPlus,
  },
  {
    key: "order",
    label: "Create Sales Order",
    hint: "Raise an order for a customer",
    href: "/order/new",
    Icon: ShoppingCart,
  },
  {
    key: "followup",
    label: "Add Follow-up",
    hint: "Schedule the next conversation",
    href: "/followup/new",
    Icon: CalendarPlus,
  },
];

export function QuickActionsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <View
        style={[styles.sheet, { paddingBottom: insets.bottom + space.section }]}
      >
        <View style={styles.grabber} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Quick Actions</Text>
            <Text style={styles.subtitle}>
              Create and keep your sales moving.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={12}
          >
            <X size={18} color={color.muted} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.grid}>
          {ACTIONS.map((action) => (
            <PressScale
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityHint={action.hint}
              onPress={() => {
                onClose();
                router.push(action.href as never);
              }}
              style={styles.card}
            >
              <View style={styles.plate}>
                <action.Icon size={22} color={color.primary} strokeWidth={2} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {action.label}
              </Text>
              <Text style={styles.cardHint} numberOfLines={2}>
                {action.hint}
              </Text>
            </PressScale>
          ))}
        </View>
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surfaceWhite,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 26,
    paddingTop: space.md,
    ...elevation.sheet,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.line,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: space.xl,
    marginBottom: space.lg,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontFamily: font.extrabold, fontSize: 20, color: color.ink },
  subtitle: { fontFamily: font.medium, fontSize: 12, color: color.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47.5%",
    minHeight: 150,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DFF0E7",
    backgroundColor: color.mintTint,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: space.lg,
    gap: 4,
  },
  plate: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceWhite,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  cardTitle: {
    fontFamily: font.extrabold,
    fontSize: 13,
    color: color.ink,
    textAlign: "center",
  },
  cardHint: {
    fontFamily: font.medium,
    fontSize: 11,
    lineHeight: 15,
    color: color.muted,
    textAlign: "center",
  },
});
