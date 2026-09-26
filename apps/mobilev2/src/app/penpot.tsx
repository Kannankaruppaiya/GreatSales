/**
 * Dev-only: every Penpot board, rendered by the app itself from the code
 * `pnpm design:rn` generates, so a board and the screen built from it can be
 * compared on the same device.
 *
 * Production builds never contain the boards: the require sits behind
 * `__DEV__`, which Metro folds to `false` before it collects dependencies, so
 * the 2 MB of generated code is dropped from a release bundle and this route
 * only redirects.
 */
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PenpotBoard } from "@/components/penpot/PenpotBoard";
import { Text } from "@/components/ui";
import { color, radius, space } from "@/design/tokens";
import type { PenpotBoardEntry } from "@/design/penpot";

const BOARDS: PenpotBoardEntry[] = __DEV__
  ? require("@/design/penpot").BOARDS
  : [];

export default function PenpotGallery() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState<number | null>(null);
  const loaded = useMemo(
    () => (index === null ? null : BOARDS[index].load()),
    [index],
  );

  if (!__DEV__) return <Redirect href="/" />;

  if (index !== null && loaded) {
    const go = (d: number) =>
      setIndex((index + d + BOARDS.length) % BOARDS.length);
    return (
      <View style={[styles.fill, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => setIndex(null)} hitSlop={10}>
            <Text variant="cardTitle" tone="primary">
              All boards
            </Text>
          </Pressable>
          <Text
            variant="caption"
            tone="muted"
            style={styles.barTitle}
            numberOfLines={1}
          >
            {BOARDS[index].title}
          </Text>
          <Pressable onPress={() => go(-1)} hitSlop={10}>
            <Text variant="cardTitle">‹</Text>
          </Pressable>
          <Pressable onPress={() => go(1)} hitSlop={10}>
            <Text variant="cardTitle">›</Text>
          </Pressable>
        </View>
        <ScrollView>
          <PenpotBoard Board={loaded.default} size={loaded.size} />
        </ScrollView>
      </View>
    );
  }

  const shown = BOARDS.map((b, i) => ({ ...b, i }));
  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <Text variant="pageTitle" style={styles.heading}>
        Penpot boards ({BOARDS.length})
      </Text>
      <FlatList
        data={shown}
        keyExtractor={(b) => b.slug}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => setIndex(item.i)}>
            <Text variant="cardTitle">{item.title}</Text>
            <Text variant="caption" tone="muted">
              {item.slug}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.canvas },
  heading: { paddingHorizontal: space.gutter, paddingVertical: space.md },
  list: {
    paddingHorizontal: space.gutter,
    gap: space.sm,
    paddingBottom: space.section,
  },
  row: {
    backgroundColor: color.surfaceWhite,
    borderRadius: radius.card,
    padding: space.md,
    borderWidth: 1,
    borderColor: color.line,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.gutter,
    paddingVertical: space.sm,
  },
  barTitle: { flex: 1 },
});
