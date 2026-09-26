/**
 * 01B — Enable Location Access.
 *
 * From the Penpot board "Screen 01B Location": four mint badges orbiting a
 * phone illustration, the heading and body, then the allow / not-now pair and
 * the reassurance note.
 *
 * The design's 01B flow has five follow-on states (OS prompt, denied,
 * re-request, success). Those are the operating system's own dialog and the
 * outcomes of it, so they are handled as states of this one screen rather than
 * as separate routes — the OS sheet is not ours to draw.
 */
import React, { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CircleAlert,
  MapPin,
  ShieldCheck,
} from "lucide-react-native";

import { Button, Card, Text } from "@/components/ui";
import { OnboardingBackdrop } from "@/components/brand/Decor";
import LocationIllustration from "@/components/penpot-parts/LocationIllustration";
import LocationRetryIllustration from "@/components/penpot-parts/LocationRetryIllustration";
import { color, font, space } from "@/design/tokens";

type PermissionState = "asking" | "denied";

export default function LocationPermissionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<PermissionState>("asking");
  const [busy, setBusy] = useState(false);
  const { width } = useWindowDimensions();

  async function request() {
    setBusy(true);
    try {
      // expo-location's request opens the OS dialog — screens 01B-OS and the
      // outcomes below are that dialog and what it returns.
      const Location = await import("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        router.replace("/preparing");
      } else {
        setState("denied");
      }
    } catch {
      // No location module available (web preview): carry on rather than
      // stranding the user on a permission screen they cannot answer.
      router.replace("/preparing");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <OnboardingBackdrop />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + space.xxl,
            paddingBottom: insets.bottom + space.section,
          },
        ]}
      >
        {/* Straight from the Penpot boards 01B (asking) and 01B-D (retry). */}
        <View style={styles.illustration}>
          {state === "denied" ? (
            <LocationRetryIllustration />
          ) : (
            <LocationIllustration width={Math.min(width - space.gutter * 2, 340)} />
          )}
        </View>

        <Text style={styles.heading} align="center" variant="hero">
          Enable Location Access
        </Text>
        <Text variant="body" tone="muted" align="center" style={styles.body}>
          We use your location to show nearby customers, track visits and give
          you better recommendations.
        </Text>

        {state === "denied" ? (
          <Card tone="amber" style={styles.deniedCard}>
            <View style={styles.deniedRow}>
              <CircleAlert size={18} color={color.amber} strokeWidth={2} />
              <Text variant="caption" style={styles.deniedText}>
                Location is off. You can still use GreatSales — visits just will
                not carry a pin. Turn it on any time in your phone's settings.
              </Text>
            </View>
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={state === "denied" ? "Try Again" : "Allow Location Access"}
            icon={
              <MapPin size={19} color={color.surfaceWhite} strokeWidth={2} />
            }
            size="hero"
            block
            loading={busy}
            onPress={request}
          />
          <Button
            label={state === "denied" ? "Continue Without Location" : "Not Now"}
            variant="ghost"
            size="hero"
            block
            onPress={() => router.replace("/preparing")}
          />
        </View>

        <View style={styles.note}>
          <ShieldCheck size={16} color={color.muted} strokeWidth={2} />
          <Text variant="caption" tone="muted" style={styles.noteText}>
            Your location is secure with us. We never share it without your
            permission.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surfaceWhite },
  content: { flex: 1, paddingHorizontal: space.gutter },
  illustration: {
    minHeight: 250,
    marginTop: space.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { marginTop: space.xxl },
  body: {
    marginTop: space.md,
    paddingHorizontal: space.md,
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 24,
  },
  deniedCard: { marginTop: space.xl },
  deniedRow: { flexDirection: "row", gap: space.sm },
  deniedText: { flex: 1, lineHeight: 16 },
  actions: { marginTop: "auto", gap: space.md },
  note: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xl,
    alignItems: "flex-start",
  },
  noteText: { flex: 1, lineHeight: 15 },
});
