/**
 * 03I — Opportunity Actions.
 *
 * From the Penpot board "03C.5 Actions". The spec's rule for this sheet is
 * "only actions actually supported by product truth", so each row below was
 * checked against the API before it was listed:
 *
 *   Change stage      → PATCH /leads/:id
 *   Add follow-up     → POST  /followups
 *   Create sales order→ POST  /orders
 *   Edit opportunity  → PATCH /leads/:id
 *   View customer     → GET   /customers/:id
 *
 * Nothing else from the design's wider action vocabulary is offered here.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  Building2,
  ChevronRight,
  Clock,
  Send,
  ShoppingCart,
  SquarePen,
  Trash2,
} from "lucide-react-native";

import { BottomSheet, Button, Text } from "@/components/ui";
import { color, radius, space } from "@/design/tokens";

export type OpportunityAction =
  | "change-stage"
  | "add-follow-up"
  | "create-order"
  | "edit"
  | "view-customer"
  | "delete";

interface ActionSpec {
  key: OpportunityAction;
  label: string;
  hint: string;
  Icon: typeof Send;
}

const ACTIONS: ActionSpec[] = [
  {
    key: "change-stage",
    label: "Change Stage",
    hint: "Move opportunity to another stage",
    Icon: Send,
  },
  {
    key: "add-follow-up",
    label: "Add Follow-up",
    hint: "Schedule a call, meeting or task",
    Icon: Clock,
  },
  {
    key: "create-order",
    label: "Create Sales Order",
    hint: "Convert this opportunity to an order",
    Icon: ShoppingCart,
  },
  {
    key: "edit",
    label: "Edit Opportunity",
    hint: "Update opportunity details",
    Icon: SquarePen,
  },
  {
    key: "view-customer",
    label: "View Customer",
    hint: "Open the full customer record",
    Icon: Building2,
  },
  {
    key: "delete",
    label: "Delete Opportunity",
    hint: "Remove it from your pipeline",
    Icon: Trash2,
  },
];

export function OpportunityActionsSheet({
  visible,
  onClose,
  onSelect,
  /** Rows to hide — e.g. view-customer when the deal has no customer record. */
  hidden = [],
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: OpportunityAction) => void;
  hidden?: OpportunityAction[];
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Take Action"
      footer={<Button label="Cancel" variant="ghost" block onPress={onClose} />}
    >
      <View style={styles.list}>
        {ACTIONS.filter((a) => !hidden.includes(a.key)).map((action) => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityHint={action.hint}
            onPress={() => {
              onClose();
              onSelect(action.key);
            }}
            style={({ pressed }) => [
              styles.row,
              pressed ? styles.rowPressed : null,
            ]}
          >
            <View style={styles.tile}>
              <action.Icon
                size={18}
                color={color.primaryDark}
                strokeWidth={2}
              />
            </View>
            <View style={styles.text}>
              <Text variant="cardTitle">{action.label}</Text>
              <Text variant="caption" tone="muted">
                {action.hint}
              </Text>
            </View>
            <ChevronRight size={16} color={color.muted2} strokeWidth={2} />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surfaceWhite,
  },
  rowPressed: { opacity: 0.88 },
  tile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
});
