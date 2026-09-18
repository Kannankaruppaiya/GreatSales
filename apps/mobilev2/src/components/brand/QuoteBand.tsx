/**
 * The footer of the board "02C.1 Follow-ups Overview": a pull-quote in the
 * brand script, the swoosh under it, then a photograph.
 *
 * Measurements are the board's own — Caveat 20/1.15 centred in #3E6374, the
 * swoosh 83×9 below it, and the photo 365×186 at radius 21 with a white 22%
 * lift over it, which is what keeps the picture quiet enough to sit under a
 * list without competing with it.
 *
 * With no photo exported yet the band falls back to the mint surface, so the
 * quote still reads and nothing invented fills the gap.
 */
import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";

import { color, font, space } from "@/design/tokens";
import { followUpsPhoto } from "@/lib/photos";

import { Text } from "../ui/Text";
import { BrandSwoosh } from "./Decor";

export function QuoteBand() {
  const photo = followUpsPhoto();

  return (
    <View style={styles.root}>
      <Text style={styles.quote}>{"“Consistent follow-ups"}</Text>
      <Text style={styles.quote}>{"create stronger relationships.”"}</Text>

      <View style={styles.swoosh}>
        <BrandSwoosh stroke={color.primary} />
      </View>

      {photo ? (
        <ImageBackground
          source={photo}
          style={styles.photo}
          imageStyle={styles.photoImage}
          resizeMode="cover"
          // Decorative: the quote above already carries the meaning.
          aria-hidden
        >
          <View style={styles.lift} />
        </ImageBackground>
      ) : (
        <View style={[styles.photo, styles.photoFallback]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: space.xxl, alignItems: "center" },
  quote: {
    fontFamily: font.script,
    fontSize: 20,
    lineHeight: 23,
    color: color.quoteInk,
    textAlign: "center",
  },
  swoosh: { width: 83, marginTop: space.sm },
  photo: {
    height: 186,
    alignSelf: "stretch",
    // The board insets the photo by 5, not by the screen gutter: it reads as a
    // band under the content rather than another card in the list.
    marginHorizontal: -space.gutter + 5,
    marginTop: space.xl,
    borderRadius: 21,
    overflow: "hidden",
  },
  photoImage: {
    // Explicit size: react-native-web otherwise lays the inner image out at the
    // file's intrinsic width, which crops the band to the left of the picture.
    width: "100%",
    height: "100%",
    borderRadius: 21,
  },
  photoFallback: { backgroundColor: color.mintSurface },
  lift: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.surfaceWhite,
    opacity: 0.22,
  },
});
