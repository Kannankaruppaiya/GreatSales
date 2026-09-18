/**
 * The promo card on the board "03.2 All Stages".
 *
 * 340×158 at radius 16 over the mint tint, with the art bleeding past the top
 * and bottom (the board draws it 340×227 at y −22, clipped by the card) and a
 * white veil over it so the copy stays legible against the illustration. The
 * veil is the board's own gradient: white at 86% running to nothing across and
 * slightly down, which is what keeps the left column readable while the peak on
 * the right stays visible.
 *
 * Without the exported art the card is just the mint tint, which is the design
 * with its picture removed rather than a substitute picture.
 */
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { color, font, radius, space } from "@/design/tokens";
import { promoArt } from "@/lib/photos";

import { Text } from "../ui/Text";

const CARD_HEIGHT = 158;
/** The art is taller than the card and sits 22 above it, per the board. */
const ART_HEIGHT = 227;
const ART_OFFSET = -22;

export function PromoCard() {
  const art = promoArt();

  return (
    <View style={styles.card}>
      {art ? (
        <>
          <Image
            source={art}
            style={styles.art}
            resizeMode="cover"
            aria-hidden
          />
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id="promoVeil" x1="0" y1="0.4" x2="1" y2="0.8">
                <Stop
                  offset="0"
                  stopColor={color.surfaceWhite}
                  stopOpacity="0.86"
                />
                <Stop
                  offset="0.5"
                  stopColor={color.surfaceWhite}
                  stopOpacity="0.38"
                />
                <Stop
                  offset="1"
                  stopColor={color.surfaceWhite}
                  stopOpacity="0"
                />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#promoVeil)"
            />
          </Svg>
        </>
      ) : null}

      <View style={styles.copy}>
        <Text style={styles.title}>Keep your pipeline moving.</Text>
        <Text style={styles.sub}>Turn opportunities into</Text>
        <Text style={styles.sub}>long-term customers.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    marginTop: space.xl,
    borderRadius: radius.hero,
    backgroundColor: color.mintTint,
    overflow: "hidden",
    justifyContent: "center",
  },
  art: {
    position: "absolute",
    left: 0,
    top: ART_OFFSET,
    // Width is explicit: react-native-web falls back to the file's intrinsic
    // width when a positioned Image is sized by left/right alone, which draws
    // the art at twice the card's width and leaves only its sky on screen.
    width: "100%",
    height: ART_HEIGHT,
  },
  copy: { paddingHorizontal: space.gutter },
  title: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 18,
    color: color.ink,
  },
  sub: {
    fontFamily: font.medium,
    fontSize: 11,
    lineHeight: 15,
    color: color.promoSub,
  },
});
