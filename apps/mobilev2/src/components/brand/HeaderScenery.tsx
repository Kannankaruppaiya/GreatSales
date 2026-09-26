/**
 * The pale mountain ridge behind the Home greeting, taken from the Penpot board
 * "Screen 01D Sales Home" (layers hdr-wash, hdr-mountains, hdr-fade) through
 * `pnpm design:rn` — the paths and colours below are that board's, not
 * redrawn.
 *
 * Three layers, back to front: a white wash that fades out downwards, two ridge
 * silhouettes, and a canvas-coloured fade at the foot so the ridge dissolves
 * into the page instead of ending on a hard edge. It stretches to the screen
 * width; the ridge is abstract enough that a few percent of horizontal stretch
 * is invisible.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Rect,
  Stop,
  SvgXml,
} from "react-native-svg";

import { color } from "@/design/tokens";

// Both ridges share the board's own coordinate frame (the back one's box), so
// one viewBox places them exactly as the board does.
const RIDGES = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4197 455.3 376 109.7" preserveAspectRatio="none" fill="none"><path d="M4197.0,514.375L4246.439453125,475.0L4282.86865234375,500.3125L4332.30810546875,455.3125L4386.95166015625,497.5L4438.9931640625,466.5625L4488.4326171875,503.125L4537.8720703125,472.1875L4573.0,497.5L4573.0,565.0L4197.0,565.0Z" fill="#e6f1ec"/><path d="M4197.0,534.0625L4254.24560546875,500.3125L4303.68505859375,525.625L4360.9306640625,489.0625L4418.1767578125,520.0L4472.8203125,494.6875L4524.86181640625,525.625L4573.0,505.9375L4573.0,565.0L4197.0,565.0Z" fill="#d8e8e1"/></svg>`;

const RIDGE_HEIGHT = 110;
const FADE_HEIGHT = 78;
/** On the board the ridge stops 11px above the bottom of the fade. */
const RIDGE_LIFT = 11;

/** Fills its parent, behind the parent's other children. */
export function HeaderScenery() {
  return (
    <View pointerEvents="none" style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="hdrWash" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset={0} stopColor={color.surfaceWhite} stopOpacity={1} />
            <Stop offset={1} stopColor={color.surfaceWhite} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#hdrWash)" />
      </Svg>

      <SvgXml
        xml={RIDGES}
        width="100%"
        height={RIDGE_HEIGHT}
        style={[styles.ridge, { bottom: RIDGE_LIFT }]}
      />

      <Svg style={styles.fade} width="100%" height={FADE_HEIGHT}>
        <Defs>
          <LinearGradient id="hdrFade" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset={0} stopColor={color.canvas} stopOpacity={0} />
            <Stop offset={1} stopColor={color.canvas} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#hdrFade)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  ridge: { position: "absolute", left: 0, right: 0 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
