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
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CircleAlert,
  MapPin,
  Navigation,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react-native";

import { Button, Card, Text } from "@/components/ui";
import { OnboardingBackdrop } from "@/components/brand/Decor";
import { color, radius, space } from "@/design/tokens";

type PermissionState = "asking" | "denied";

const BADGES = [
  { key: "track", label: "Track Visits", Icon: MapPin, top: 0, left: 8 },
  {
    key: "nearby",
    label: "Nearby\nCustomers",
    Icon: Users,
    top: -34,
    right: 8,
  },
  { key: "plan", label: "Plan Better", Icon: Route, top: 135, left: 13 },
  {
    key: "reports",
    label: "Accurate\nReports",
    Icon: Navigation,
    top: 119,
    right: 13,
  },
] as const;

export default function LocationPermissionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<PermissionState>("asking");
  const [busy, setBusy] = useState(false);

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
        <View style={styles.illustration}>
          <View style={styles.ringOuter} />
          <View style={styles.ringInner} />
          <View style={styles.phone}>
            <MapPin size={34} color={color.primary} strokeWidth={2} />
          </View>

          {BADGES.map((badge) => (
            <View
              key={badge.key}
              style={[
                styles.badge,
                {
                  top: badge.top,
                  ...("left" in badge ? { left: badge.left } : {}),
                  ...("right" in badge ? { right: badge.right } : {}),
                },
              ]}
            >
              <View style={styles.badgeCircle}>
                <badge.Icon
                  size={22}
                  color={color.primaryDark}
                  strokeWidth={2}
                />
              </View>
              <Text variant="caption" align="center" style={styles.badgeLabel}>
                {badge.label}
              </Text>
            </View>
          ))}
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
            block
            loading={busy}
            onPress={request}
          />
          <Button
            label={state === "denied" ? "Continue Without Location" : "Not Now"}
            variant="ghost"
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
    height: 250,
    marginTop: space.section,
    alignItems: "center",
    justifyContent: "center",
  },
  ringOuter: {
    position: "absolute",
    width: 229,
    height: 229,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
  },
  ringInner: {
    position: "absolute",
    width: 165,
    height: 165,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.lineSoft,
  },
  phone: {
    width: 86,
    height: 140,
    borderRadius: radius.hero,
    backgroundColor: color.mintTint,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    width: 104,
    alignItems: "center",
    gap: space.sm,
  },
  badgeCircle: {
    width: 55,
    height: 55,
    borderRadius: radius.pill,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLabel: { lineHeight: 15 },
  heading: { marginTop: space.xxl },
  body: { marginTop: space.md, paddingHorizontal: space.md },
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
