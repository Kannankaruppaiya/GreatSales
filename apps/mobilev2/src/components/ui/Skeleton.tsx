/**
 * Loading skeletons, per the Penpot board "17 — Loading Skeletons".
 *
 * A pulsing Line-coloured block. Skeletons mirror the shape of what is coming
 * so the layout does not jump when the rows arrive.
 */
import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { color, radius, space } from "@/design/tokens";

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = "100%",
  height = 12,
  style,
}: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      aria-hidden
      style={[styles.block, { width, height, opacity: pulse }, style]}
    />
  );
}

/** A stand-in for a list of cards while the first page loads. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.card}>
          <Skeleton width="55%" height={13} />
          <Skeleton width="80%" height={11} />
          <Skeleton width="35%" height={11} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: color.line, borderRadius: 6 },
  list: { gap: space.md },
  card: {
    backgroundColor: color.surfaceWhite,
    borderRadius: radius.listCard,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.xl,
    gap: space.sm,
  },
});
