/**
 * Draws a generated Penpot board at the phone's width.
 *
 * The generated components are absolutely positioned at their design width
 * (376 for a phone board), so they are scaled as a whole rather than
 * reflowed: that is what keeps them a faithful reference of the design.
 */
import React from "react";
import type { ComponentType } from "react";
import { View, useWindowDimensions } from "react-native";

export function PenpotBoard({
  Board,
  size,
  width: fixedWidth,
}: {
  Board: ComponentType;
  size: { width: number; height: number };
  /** Defaults to the window width. */
  width?: number;
}) {
  const window = useWindowDimensions();
  const width = fixedWidth ?? window.width;
  const scale = width / size.width;
  return (
    <View style={{ width, height: size.height * scale, overflow: "hidden" }}>
      <View
        style={{
          width: size.width,
          height: size.height,
          transformOrigin: "top left",
          transform: [{ scale }],
        }}
      >
        <Board />
      </View>
    </View>
  );
}
