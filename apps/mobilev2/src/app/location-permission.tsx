/**
 * 01B — Enable Location Access, and the four states the Penpot file draws
 * after it. Each state's artwork is lifted from its own board by
 * `pnpm design:rn` (components/penpot-parts), not redrawn.
 *
 *   asking   01B    four badges around the phone, Allow / Not Now
 *   reconsider 01B-D "Let's Try Again" — the three reasons, after "Not Now"
 *   off      01B-C  the OS said no: open Settings, retry, or carry on
 *   granted  01B-E  "Location Access Enabled!", then Continue
 *
 * The OS permission sheet itself is the operating system's to draw; these are
 * the screens around it. None of them blocks the app: every state has a way
 * forward without location, because a rep with location off can still work.
 */
import React, { useState } from "react";
import { Linking, StyleSheet, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowRight,
  BarChart3,
  Info,
  MapPin,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react-native";

import { Button, Card, Text } from "@/components/ui";
import { OnboardingBackdrop } from "@/components/brand/Decor";
import HandwrittenSwoosh from "@/components/penpot-parts/HandwrittenSwoosh";
import LocationEnabledIllustration from "@/components/penpot-parts/LocationEnabledIllustration";
import LocationIllustration from "@/components/penpot-parts/LocationIllustration";
import LocationOffIllustration from "@/components/penpot-parts/LocationOffIllustration";
import LocationRetryIllustration from "@/components/penpot-parts/LocationRetryIllustration";
import { color, font, space } from "@/design/tokens";
import { haptic } from "@/lib/haptics";

type PermissionState = "asking" | "reconsider" | "off" | "granted";

const REASONS = [
  { key: "nearby", label: "Find nearby customers", Icon: Users },
  { key: "routes", label: "Plan better routes", Icon: Route },
  { key: "insights", label: "Get area-wise insights", Icon: BarChart3 },
] as const;

export default function LocationPermissionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<PermissionState>("asking");
  const [busy, setBusy] = useState(false);

  const art = Math.min(width - space.gutter * 2, 340);
  const proceed = () => router.replace("/preparing");

  async function request() {
    setBusy(true);
    try {
      const Location = await import("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        haptic.success();
        setState("granted");
      } else {
        setState("off");
      }
    } catch {
      // No location module (the web preview): carry on rather than strand the
      // user on a question the platform cannot ask.
      proceed();
    } finally {
      setBusy(false);
    }
  }

  const content = {
    asking: {
      art: <LocationIllustration width={art} />,
      title: "Enable Location Access",
      body: "We use your location to show nearby customers, track visits and give you better recommendations.",
    },
    reconsider: {
      art: <LocationRetryIllustration />,
      title: "Let's Try Again",
      body: "Tap the button below to enable location access and get the full field sales experience.",
    },
    off: {
      art: <LocationOffIllustration />,
      title: "Location Access is Off",
      body: "We couldn't access your location. Some features like nearby customers, route planning and location-based insights may be limited.",
    },
    granted: {
      art: <LocationEnabledIllustration width={art} />,
      title: "Location Access Enabled!",
      body: "You're all set. We'll use your location to bring you relevant customers, better insights and a smoother field sales experience.",
    },
  }[state];

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
        <View style={styles.illustration}>{content.art}</View>

        <Text style={styles.heading} align="center">
          {content.title}
        </Text>
        <Text align="center" style={styles.body}>
          {content.body}
        </Text>

        {state === "reconsider" ? (
          <Card style={styles.reasons}>
            {REASONS.map((reason) => (
              <View key={reason.key} style={styles.reason}>
                <reason.Icon size={20} color={color.primary} strokeWidth={2} />
                <Text style={styles.reasonText}>{reason.label}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {state === "off" ? (
          <Card style={styles.noteCard}>
            <View style={styles.noteRow}>
              <Info size={20} color={color.steel} strokeWidth={2} />
              <View style={styles.noteBody}>
                <Text style={styles.noteTitle}>You can still continue</Text>
                <Text style={styles.noteDetail}>
                  You can use the app without location and enable it anytime
                  from settings.
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {state === "granted" ? (
          <View style={styles.script}>
            <Text style={styles.scriptLine}>More</Text>
            <Text style={styles.scriptLine}>opportunities ahead.</Text>
            <HandwrittenSwoosh width={151} />
          </View>
        ) : null}

        <View style={styles.actions}>
          {state === "asking" ? (
            <>
              <Button
                label="Allow Location Access"
                icon={
                  <MapPin
                    size={19}
                    color={color.surfaceWhite}
                    strokeWidth={2}
                  />
                }
                size="hero"
                block
                loading={busy}
                onPress={request}
              />
              <Button
                label="Not Now"
                variant="ghost"
                size="hero"
                block
                onPress={() => setState("reconsider")}
              />
            </>
          ) : null}

          {state === "reconsider" ? (
            <>
              <Button
                label="Try Again"
                icon={
                  <ArrowRight
                    size={19}
                    color={color.surfaceWhite}
                    strokeWidth={2.2}
                  />
                }
                size="hero"
                block
                loading={busy}
                onPress={request}
              />
              <Button
                label="Not Now"
                variant="ghost"
                size="hero"
                block
                onPress={proceed}
              />
            </>
          ) : null}

          {state === "off" ? (
            <>
              <Button
                label="Open App Settings"
                size="hero"
                labelSize={16}
                block
                onPress={() => void Linking.openSettings()}
              />
              <Button
                label="Retry Permission"
                variant="secondary"
                size="hero"
                labelSize={16}
                block
                loading={busy}
                onPress={request}
              />
              <Button
                label="Continue Without Location"
                variant="ghost"
                size="hero"
                labelSize={16}
                block
                onPress={proceed}
              />
            </>
          ) : null}

          {state === "granted" ? (
            <Button
              label="Continue"
              icon={
                <ArrowRight
                  size={19}
                  color={color.surfaceWhite}
                  strokeWidth={2.2}
                />
              }
              size="hero"
              block
              onPress={proceed}
            />
          ) : null}
        </View>

        {state === "asking" ? (
          <View style={styles.note}>
            <ShieldCheck size={16} color={color.muted} strokeWidth={2} />
            <Text variant="caption" tone="muted" style={styles.noteText}>
              Your location is secure with us. We never share it without your
              permission.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surfaceWhite },
  content: { flex: 1, paddingHorizontal: space.gutter },
  illustration: {
    minHeight: 220,
    marginTop: space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    marginTop: space.xl,
    fontFamily: font.extrabold,
    fontSize: 22,
    lineHeight: 29,
    color: color.ink,
  },
  body: {
    marginTop: space.md,
    paddingHorizontal: space.md,
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 23,
    color: color.muted,
  },
  reasons: { marginTop: space.xl, gap: space.lg },
  reason: { flexDirection: "row", alignItems: "center", gap: space.md },
  reasonText: { fontFamily: font.medium, fontSize: 14, color: color.inkDeep },
  noteCard: { marginTop: space.xl },
  noteRow: { flexDirection: "row", gap: space.md },
  noteBody: { flex: 1, gap: 2 },
  noteTitle: { fontFamily: font.bold, fontSize: 14, color: color.ink },
  noteDetail: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16,
    color: color.muted,
  },
  script: { alignItems: "flex-end", marginTop: space.lg },
  scriptLine: {
    fontFamily: font.script,
    fontSize: 20,
    lineHeight: 23,
    color: color.ink,
  },
  actions: { marginTop: "auto", gap: space.md, paddingTop: space.xl },
  note: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xl,
    alignItems: "flex-start",
  },
  noteText: { flex: 1, lineHeight: 15 },
});
