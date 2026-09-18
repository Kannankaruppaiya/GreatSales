/**
 * Empty state, per the Penpot board "16 — Empty States".
 *
 * The brand voice board is specific about these: "say what to do next". So the
 * action is part of the component rather than optional decoration, and the body
 * copy is a sentence, not a shrug.
 */
import React from "react";
import { StyleSheet, View } from "react-native";

import { color, radius, space } from "@/design/tokens";

import { Button } from "./Button";
import { Text } from "./Text";

export interface EmptyStateProps {
  title: string;
  /** What to do next. Required by the voice rules, not merely allowed. */
  body: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  body,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.root}>
      {icon ? <View style={styles.plate}>{icon}</View> : null}
      <Text variant="section" align="center">
        {title}
      </Text>
      <Text variant="body" tone="muted" align="center" style={styles.body}>
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          size="medium"
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", paddingVertical: space.xxl * 2, gap: space.md },
  plate: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: color.mintTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  body: { maxWidth: 260 },
});
