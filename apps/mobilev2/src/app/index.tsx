/**
 * 01 — Splash / Welcome.
 *
 * From the Penpot board "Screen 01 Splash": a full-bleed photograph under a
 * darkening scrim, the brand lockup reversed out of it, the Caveat script over
 * the image, and a white panel at the foot carrying the tagline and the one
 * call to action.
 *
 * The photograph is an asset that has to be exported from Penpot (see
 * `assets/README.md`). Until it is present the screen falls back to the brand
 * green rather than to an invented illustration — a missing photo should look
 * like a missing photo.
 */
import React from "react";
import { ImageBackground, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight } from "lucide-react-native";

import { Text } from "@/components/ui";
import { BrandSwoosh } from "@/components/brand/Decor";
import { color, elevation, font, space } from "@/design/tokens";

/**
 * `require` of a file that may not exist would fail the bundle, so the photo is
 * resolved through a helper that returns null when it has not been added yet.
 */
function splashPhoto(): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/assets/images/splash-bg.jpg") as number;
  } catch {
    return null;
  }
}

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const photo = splashPhoto();

  const hero = (
    <View style={styles.heroContent}>
      <Text style={styles.logoG}>G</Text>
      <Text style={styles.brand}>GreatSales</Text>
      <Text style={styles.brandSub}>Field Sales CRM</Text>

      {/* Caveat, set as four short lines exactly as the design stacks them. */}
      <View style={styles.script}>
        <Text style={[styles.scriptLine, styles.scriptIndent0]}>Every</Text>
        <Text style={[styles.scriptLine, styles.scriptIndent1]}>visit</Text>
        <Text style={[styles.scriptLine, styles.scriptIndent2]}>builds</Text>
        <Text style={[styles.scriptLine, styles.scriptIndent3]}>tomorrow</Text>
        <View style={styles.swoosh}>
          <BrandSwoosh stroke={color.surfaceWhite} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {photo ? (
        <ImageBackground source={photo} style={styles.hero} resizeMode="cover">
          <View style={styles.scrim} />
          <View style={[styles.heroInner, { paddingTop: insets.top + space.xxl }]}>
            {hero}
          </View>
        </ImageBackground>
      ) : (
        <View style={[styles.hero, styles.heroFallback]}>
          <View style={[styles.heroInner, { paddingTop: insets.top + space.xxl }]}>
            {hero}
          </View>
        </View>
      )}

      <View style={[styles.panel, { paddingBottom: insets.bottom + space.section }]}>
        <Text style={styles.tagline}>Sell Smarter.</Text>
        <Text style={styles.tagline}>Go Further.</Text>
        <Text variant="body" tone="muted" align="center" style={styles.trackLine}>
          Track · Engage · Grow
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get started"
          onPress={() => router.replace("/login")}
          style={({ pressed }) => [styles.cta, pressed ? styles.ctaPressed : null]}
        >
          <Text style={styles.ctaLabel}>Get Started</Text>
          <ArrowRight size={19} color={color.surfaceWhite} strokeWidth={2.5} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surfaceWhite },
  hero: { flex: 1 },
  heroFallback: { backgroundColor: color.primaryDark },
  // The design darkens the top of the photograph so the white lockup holds.
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,27,36,0.34)" },
  heroInner: { flex: 1, paddingHorizontal: space.gutter },
  heroContent: { alignItems: "center" },
  logoG: { fontFamily: font.extrabold, fontSize: 42, color: "#2FCB7C" },
  brand: {
    fontFamily: font.extrabold,
    fontSize: 27,
    color: color.surfaceWhite,
    marginTop: space.section,
  },
  brandSub: {
    fontFamily: font.medium,
    fontSize: 13,
    color: color.surfaceWhite,
    marginTop: space.xs,
  },
  script: { alignSelf: "stretch", marginTop: space.xxl },
  scriptLine: {
    fontFamily: font.script,
    fontSize: 39,
    color: color.surfaceWhite,
    lineHeight: 41,
  },
  // The four lines step inward, as they do in the design.
  scriptIndent0: { marginLeft: 21 },
  scriptIndent1: { marginLeft: 45 },
  scriptIndent2: { marginLeft: 29 },
  scriptIndent3: { marginLeft: 50 },
  swoosh: { marginLeft: 45, marginTop: space.sm },
  panel: {
    backgroundColor: color.surfaceWhite,
    borderTopLeftRadius: 31,
    borderTopRightRadius: 31,
    paddingHorizontal: space.xxl,
    paddingTop: space.section,
    marginTop: -31,
  },
  tagline: {
    fontFamily: font.extrabold,
    fontSize: 25,
    color: color.ink,
    textAlign: "center",
    lineHeight: 31,
  },
  trackLine: { marginTop: space.sm },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: 49,
    borderRadius: 13,
    backgroundColor: color.primary,
    marginTop: space.section,
    ...elevation.primary,
  },
  ctaPressed: { opacity: 0.92 },
  ctaLabel: { fontFamily: font.bold, fontSize: 18, color: color.surfaceWhite },
});
