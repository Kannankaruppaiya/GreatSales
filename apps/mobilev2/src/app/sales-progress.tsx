/**
 * 02A — Sales Progress.
 *
 * From the Penpot board "02A Screen 02A.1": a period selector, the achievement
 * headline with its month-on-month delta, six KPI tiles, and the breakdown
 * call to action.
 *
 * Achievement is computed from the projections for the selected period, so the
 * percentage and the two figures under it can never disagree — they are one
 * calculation, not three numbers.
 */
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  CalendarDays,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";

import {
  AppBar,
  Button,
  Card,
  Panel,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { color, font, space } from "@/design/tokens";
import { OptionSheet } from "@/components/form";
import { moneyShort, percent, shiftPeriod } from "@/lib/format";
import { defaultPeriod, periodLabel } from "@/lib/projection-labels";
import { useAsync } from "@/lib/useAsync";

/** "2026-09" → "September 2026", for the period pill. */
export default function SalesProgressScreen() {
  const router = useRouter();
  const source = useData();
  const [period, setPeriod] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const state = useAsync(async () => {
    const periods = await source.listProjectionPeriods();
    const active = period ?? defaultPeriod(periods);
    if (!active) return null;

    // The previous month, for the delta. Taken from the same endpoint so the
    // comparison is like for like.
    const previousPeriod = shiftPeriod(active, -1);
    const [progress, previous, summary, dueThisWeek] = await Promise.all([
      source.getSalesProgress(active),
      source.getSalesProgress(previousPeriod),
      source.getHomeSummary(),
      source.listFollowUps({ bucket: "week", limit: 1 }),
    ]);

    const achieved = progress.totalAchieved;
    // Against the month's target when one is set; against what was committed
    // when it is not. The screen says which.
    const base = progress.target ?? progress.totalCommitted;
    const delta =
      previous.totalAchieved > 0
        ? ((achieved - previous.totalAchieved) / previous.totalAchieved) * 100
        : null;

    return {
      periods,
      active,
      progress,
      achieved,
      base,
      achievement: base > 0 ? (achieved / base) * 100 : 0,
      gap: Math.max(0, base - achieved),
      delta,
      pipelineValue: summary.openOpportunityValue,
      openOpportunities: summary.openOpportunities,
      followUpsThisWeek: dueThisWeek.total,
    };
  }, [source, period]);

  const data = state.data;

  return (
    <Screen
      bleed
      onRefresh={state.reload}
      refreshing={state.refreshing}
      error={state.error}
    >
      <AppBar title="Sales Progress" />

      <View style={styles.body}>
        {state.loading || !data ? (
          <SkeletonList rows={3} />
        ) : (
          <>
            <Card
              style={styles.periodCard}
              onPress={() => setPickerOpen(true)}
              accessibilityLabel={`Period, ${periodLabel(data.active)}. Tap to change.`}
            >
              <View style={styles.periodRow}>
                <CalendarDays size={18} color={color.muted} strokeWidth={2} />
                <Text variant="cardTitle" style={styles.periodLabel}>
                  {periodLabel(data.active)}
                </Text>
              </View>
            </Card>

            <View style={styles.achievement}>
              <Text variant="caption" tone="muted" align="center">
                {data.progress.target != null
                  ? "Achievement against target"
                  : "Achievement against commitment · no target set"}
              </Text>
              <Text style={styles.achievementValue} align="center">
                {percent(data.achievement)}
              </Text>
              <Text variant="cardTitle" tone="primaryDark" align="center">
                {moneyShort(data.achieved)} / {moneyShort(data.base)}
              </Text>
              {data.gap > 0 ? (
                <Text variant="caption" tone="muted" align="center">
                  {moneyShort(data.gap)} to go
                </Text>
              ) : null}
            </View>

            {data.delta != null ? (
              <Panel tone="mint" style={styles.delta}>
                <View style={styles.deltaRow}>
                  {data.delta >= 0 ? (
                    <TrendingUp
                      size={17}
                      color={color.primaryDark}
                      strokeWidth={2}
                    />
                  ) : (
                    <TrendingDown
                      size={17}
                      color={color.redDark}
                      strokeWidth={2}
                    />
                  )}
                  <Text
                    variant="section"
                    tone={data.delta >= 0 ? "primaryDark" : "redDark"}
                  >
                    {data.delta >= 0 ? "+" : ""}
                    {percent(data.delta)}
                  </Text>
                </View>
                <Text variant="caption" tone="muted" align="center">
                  vs. last month
                </Text>
              </Panel>
            ) : null}

            <View style={styles.tiles}>
              <Tile
                value={
                  data.progress.target != null
                    ? moneyShort(data.progress.target)
                    : "Not set"
                }
                label="Target"
              />
              <Tile
                value={moneyShort(data.progress.totalCommitted)}
                label="Committed"
              />
              <Tile
                value={moneyShort(data.progress.recurringAchieved)}
                label="Recurring Achieved"
              />
              <Tile
                value={moneyShort(data.progress.newSalesAchieved)}
                label="New Sales Won"
              />
              <Tile
                value={moneyShort(data.pipelineValue)}
                label={`Pipeline · ${data.openOpportunities} open`}
              />
              <Tile
                value={String(data.followUpsThisWeek)}
                label="Follow-ups This Week"
              />
            </View>

            <Button
              label="View Detailed Breakdown"
              block
              icon={
                <ArrowRight
                  size={17}
                  color={color.surfaceWhite}
                  strokeWidth={2.5}
                />
              }
              onPress={() => router.push("/projections")}
              style={styles.cta}
            />

            <View style={styles.quote}>
              <Text style={styles.quoteLine} align="center">
                “Consistent efforts
              </Text>
              <Text style={styles.quoteLine} align="center">
                create extraordinary results.”
              </Text>
            </View>
          </>
        )}
      </View>
      <OptionSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Month"
        options={(data?.periods ?? []).map((p) => ({
          value: p.period,
          label: periodLabel(p.period),
        }))}
        value={data?.active ?? null}
        onChange={setPeriod}
      />
    </Screen>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <Panel tone="mint" style={styles.tile}>
      <Text variant="section">{value}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter },
  periodCard: { marginTop: space.sm, paddingVertical: space.lg },
  periodRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  periodLabel: { flex: 1 },
  achievement: { marginTop: space.xxl, gap: space.xs },
  achievementValue: {
    fontSize: 34,
    lineHeight: 42,
    color: color.ink,
    fontFamily: font.extrabold,
  },
  delta: { marginTop: space.xl, gap: space.xs },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
    marginTop: space.xl,
  },
  // Two per row, accounting for the gap between them.
  tile: { width: "47.5%", gap: 2, minHeight: 78, justifyContent: "center" },
  cta: { marginTop: space.xl },
  quote: { marginTop: space.xxl },
  quoteLine: {
    fontFamily: font.script,
    fontSize: 18,
    lineHeight: 24,
    color: color.ink,
  },
});
