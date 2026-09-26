/**
 * The foot of a paged list: how much of it is loaded, and the way to load the
 * rest. A list that stopped at its first page with no way on used to read
 * "Showing 30 of 84" and leave the other 54 unreachable.
 */
import React from "react";
import { StyleSheet, View } from "react-native";

import { space } from "@/design/tokens";

import { Button } from "./Button";
import { Text } from "./Text";

export interface ListFooterProps {
  shown: number;
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** "customers", "deals" — what the rows are. */
  noun?: string;
}

export function ListFooter({
  shown,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
  noun = "",
}: ListFooterProps) {
  if (!hasMore && shown >= total) return null;
  return (
    <View style={styles.root}>
      <Text variant="caption" tone="muted2" align="center">
        Showing {shown} of {total}
        {noun ? ` ${noun}` : ""}
      </Text>
      {hasMore ? (
        <Button
          label={loadingMore ? "Loading…" : "Load more"}
          variant="secondary"
          onPress={onLoadMore}
          disabled={loadingMore}
          block
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md, paddingVertical: space.md },
});
