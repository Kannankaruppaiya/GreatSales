/**
 * The confirmation shown after a record is created, per the Penpot board
 * "18 — Success Confirmation". Shared by 04G, 05O, 06G and 08J.
 *
 * It states what was created and what it is worth, then offers the next steps
 * rather than dumping the person back on a list — the spec's own actions for
 * each flow ("View Opportunity", "Add Another Lead", "Back to Pipeline").
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { Button } from "../ui/Button";
import { Panel } from "../ui/Card";
import { KeyValueRow, RowDivider } from "../ui/KeyValueRow";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { color, radius, space } from "@/design/tokens";

export interface SuccessAction {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "tertiary";
}

export interface SuccessScreenProps {
  title: string;
  /** The identifier the person will quote — a lead id, an SO number. */
  reference?: string | null;
  facts: { label: string; value: string }[];
  actions: SuccessAction[];
}

export function SuccessScreen({ title, reference, facts, actions }: SuccessScreenProps) {
  return (
    <Screen tabBarSpacing bleed>
      <View style={styles.body}>
        <View style={styles.mark}>
          <Check size={34} color={color.surfaceWhite} strokeWidth={3} />
        </View>

        <Text variant="hero" align="center">
          {title}
        </Text>
        {reference ? (
          <Text variant="body" tone="muted" align="center">
            {reference}
          </Text>
        ) : null}

        {facts.length > 0 ? (
          <Panel style={styles.facts}>
            {facts.map((fact, index) => (
              <View key={fact.label}>
                {index > 0 ? <RowDivider /> : null}
                <KeyValueRow label={fact.label} value={fact.value} />
              </View>
            ))}
          </Panel>
        ) : null}

        <View style={styles.actions}>
          {actions.map((action, index) => (
            <Button
              key={action.label}
              label={action.label}
              block
              variant={action.variant ?? (index === 0 ? "primary" : "secondary")}
              onPress={action.onPress}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.gutter,
    paddingTop: space.xxl * 2,
    alignItems: "stretch",
    gap: space.md,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: space.sm,
  },
  facts: { marginTop: space.xl, paddingVertical: space.xs },
  actions: { gap: space.md, marginTop: space.xxl },
});
