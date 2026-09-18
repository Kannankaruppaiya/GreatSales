/**
 * Decorative vectors from the Penpot design, drawn as real SVG.
 *
 * These are shapes in the design, not photographs, so they are reproduced as
 * paths rather than exported as bitmaps: an SVG scales to any screen density,
 * recolours with the theme and costs a few hundred bytes. The `d` strings below
 * are the design's own path data, translated to a local origin.
 *
 * Photographs are a different matter and are handled as real image files — see
 * `assets/README.md`.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { color } from "@/design/tokens";

/**
 * The two ridge lines that close the onboarding screens.
 *
 * Design size is 376×82 — the phone frame's full width. The viewBox keeps that
 * ratio while the component stretches to whatever width it is given.
 */
export function MountainRidges({
  width = "100%",
  height = 82,
}: {
  width?: number | "100%";
  height?: number;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 376 82"
      preserveAspectRatio="none"
      // Purely decorative: it carries no information a screen reader needs.
      aria-hidden
    >
      <Path
        d="M0,51.25L49.44,27.33L85.87,42.71L135.31,15.38L189.95,41L241.99,22.21L291.43,44.42L340.87,25.63L376,41L376,82L0,82Z"
        fill="#E2F3EB"
      />
      <Path
        d="M0,63.21L57.25,42.71L106.69,58.08L163.93,35.88L221.18,54.67L275.82,39.29L327.86,58.08L376,46.13L376,82L0,82Z"
        fill="#D2EBDF"
      />
    </Svg>
  );
}

/**
 * The hand-drawn underline that sits beneath the second line of brand script.
 *
 * The brand board's words: "swoosh under the second line". It belongs to the
 * Caveat script and should not appear under UI text.
 */
export function BrandSwoosh({
  width = 148,
  height = 15,
  stroke = color.primary,
}: {
  width?: number;
  height?: number;
  stroke?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 148 20" aria-hidden>
      <Path
        d="M0,12.78C37.7,19.17 102.7,8.95 148.2,0"
        stroke={stroke}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * The mint wash the onboarding screens sit on above the ridges.
 *
 * In the design this is a rectangle with a vertical gradient from transparent
 * to Mint Tint. A flat tint at low opacity reads the same at this height and
 * avoids pulling in a gradient dependency for one decoration.
 */
export function MintWash({ height = 248 }: { height?: number }) {
  return (
    <View
      aria-hidden
      style={[styles.wash, { height, backgroundColor: color.mintTint }]}
    />
  );
}

/** Ridges pinned to the bottom of a screen, with the wash behind them. */
export function OnboardingBackdrop({
  washHeight = 248,
}: {
  washHeight?: number;
}) {
  return (
    <View pointerEvents="none" style={styles.backdrop} aria-hidden>
      <MintWash height={washHeight} />
      <View style={styles.ridges}>
        <MountainRidges />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { width: "100%" },
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  ridges: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
