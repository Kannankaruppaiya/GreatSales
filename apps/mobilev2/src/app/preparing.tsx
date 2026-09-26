/**
 * 01C — Setting up your workspace.
 *
 * From the Penpot board "Screen 01C Preparing": a checklist that fills in as
 * each step completes, a progress bar, and the brand-script quote card.
 *
 * The steps are real work, not a timed animation: each one resolves when its
 * request does. A progress screen that advances on a timer while the app is
 * actually stuck is a lie the user cannot see through.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";

import { Text } from "@/components/ui";
import { OnboardingBackdrop } from "@/components/brand/Decor";
import HandwrittenSwoosh from "@/components/penpot-parts/HandwrittenSwoosh";
import PreparingIllustration from "@/components/penpot-parts/PreparingIllustration";
import { useData } from "@/data/provider";
import { color, font, radius, space } from "@/design/tokens";

interface Step {
  key: string;
  label: string;
  run: () => Promise<unknown>;
}

export default function PreparingScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  // Built once: re-creating the list every render would restart the effect.
  const steps = useRef<Step[]>([
    {
      key: "auth",
      label: "Authenticating your account",
      run: () => source.getCurrentUser(),
    },
    {
      key: "data",
      label: "Loading your sales data",
      run: () => source.getHomeSummary(),
    },
    {
      key: "offline",
      label: "Preparing offline content",
      run: () => source.listCustomers({ limit: 20 }),
    },
    {
      key: "ready",
      label: "Almost ready...",
      run: () => source.listFollowUps({ bucket: "today", limit: 5 }),
    },
  ]).current;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (let i = 0; i < steps.length; i += 1) {
        try {
          await steps[i]!.run();
        } catch (caught) {
          if (cancelled) return;
          setFailed(
            caught instanceof Error ? caught.message : "Something went wrong.",
          );
          return;
        }
        if (cancelled) return;
        setDone(i + 1);
      }
      if (!cancelled) router.replace("/(tabs)/home");
    })();

    return () => {
      cancelled = true;
    };
  }, [steps, router]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: done / steps.length,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [done, progress, steps.length]);

  const pct = Math.round((done / steps.length) * 100);

  return (
    <View style={styles.root}>
      <OnboardingBackdrop washHeight={300} />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + space.xxl,
            paddingBottom: insets.bottom + space.section,
          },
        ]}
      >
        {/* The paper-plane scene, straight from the Penpot board 01C. */}
        <View style={styles.illustration}>
          <PreparingIllustration />
        </View>

        <View style={styles.headingBlock}>
          <Text style={styles.heading}>Setting up</Text>
          <Text style={styles.heading}>your workspace...</Text>
        </View>

        <View style={styles.steps}>
          {steps.map((step, i) => {
            const complete = i < done;
            const active = i === done;
            return (
              <View key={step.key} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepMark,
                    complete ? styles.stepMarkDone : null,
                  ]}
                >
                  {complete ? (
                    <Check
                      size={14}
                      color={color.surfaceWhite}
                      strokeWidth={3}
                    />
                  ) : null}
                </View>
                <Text
                  variant="body"
                  tone={complete || active ? "inkDeep" : "muted"}
                  style={styles.stepLabel}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        {failed ? (
          <Text variant="caption" tone="redDark" style={styles.failure}>
            {failed}
          </Text>
        ) : null}

        <View style={styles.progressRow}>
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
          <Text variant="secondary" style={styles.pct}>
            {pct}%
          </Text>
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quote}>A bigger tomorrow</Text>
          <Text style={styles.quote}>begins with the next visit.</Text>
          <View style={styles.quoteSwoosh}>
            <HandwrittenSwoosh />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FBFDFC" },
  content: { flex: 1, paddingHorizontal: space.gutter },
  illustration: { alignItems: "center", marginTop: space.lg },
  headingBlock: { marginTop: space.xl, alignItems: "center" },
  heading: {
    fontFamily: font.extrabold,
    fontSize: 25,
    color: color.ink,
    lineHeight: 31,
  },
  steps: { marginTop: space.xxl + space.sm, gap: space.section },
  stepRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
  stepMark: {
    width: 23,
    height: 23,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepMarkDone: { backgroundColor: color.primary, borderColor: color.primary },
  stepLabel: { flex: 1 },
  failure: { marginTop: space.xl },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.xxl + space.sm,
  },
  track: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#E2ECEF",
    overflow: "hidden",
  },
  fill: { height: 9, borderRadius: 5, backgroundColor: color.primary },
  pct: { fontFamily: font.bold },
  quoteCard: {
    marginTop: "auto",
    backgroundColor: "#EDF7F1",
    borderRadius: radius.hero,
    paddingVertical: space.xl,
    paddingHorizontal: space.section,
    alignItems: "center",
  },
  quote: {
    fontFamily: font.script,
    fontSize: 23,
    color: color.ink,
    lineHeight: 28,
  },
  quoteSwoosh: { marginTop: space.xs },
});
