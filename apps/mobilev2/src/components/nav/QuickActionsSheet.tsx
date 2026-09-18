/**
 * The Quick Actions launcher behind the +, per the Penpot board "13 — Bottom
 * Sheets & Quick Action Launcher".
 *
 * Four core actions only, as the navigation board specifies. Adding a fifth is
 * how the + turns into the second navigator the design says it must not be.
 */
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarPlus, ShoppingCart, UserPlus, Target } from "lucide-react-native";

import { color, elevation, radius, space } from "@/design/tokens";

import { IconPlate } from "../ui/Card";
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
    hint: "Capture an opportunity while you are with the customer",
    href: "/lead/new",
    Icon: Target,
  },
  {
    key: "customer",
    label: "Add Customer",
    hint: "Create an account you have just met",
    href: "/customer/new",
    Icon: UserPlus,
  },
  {
    key: "order",
    label: "Create Order",
    hint: "Turn an agreed deal into a sales order",
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.scrim}
        accessibilityLabel="Close"
        accessibilityRole="button"
        onPress={onClose}
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.section }]}>
        <View style={styles.grabber} />
        <Text variant="section" style={styles.title}>
          Quick Actions
        </Text>

        {ACTIONS.map((action) => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityHint={action.hint}
            onPress={() => {
              onClose();
              router.push(action.href as never);
            }}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          >
            <IconPlate size={38}>
              <action.Icon size={19} color={color.primaryDark} strokeWidth={2} />
            </IconPlate>
            <View style={styles.rowText}>
              <Text variant="cardTitle">{action.label}</Text>
              <Text variant="caption" tone="muted">
                {action.hint}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(15,50,68,0.35)" },
  sheet: {
    backgroundColor: color.surfaceWhite,
    borderTopLeftRadius: radius.hero + 6,
    borderTopRightRadius: radius.hero + 6,
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
    gap: space.xs,
    ...elevation.sheet,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.line,
    alignSelf: "center",
    marginBottom: space.md,
  },
  title: { marginBottom: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.85 },
});
