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
import { ArrowRight, CalendarDays, TrendingDown, TrendingUp } from "lucide-react-native";

import {
  AppBar,
  Button,
  Card,
  Panel,
  Screen,
  SkeletonList,
  SyntheticBanner,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { color, font, space } from "@/design/tokens";
import { moneyShort, percent } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/** "2026-09" → "September 2026", for the period pill. */
function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function SalesProgressScreen() {
  const router = useRouter();
  const source = useData();
  const [period, setPeriod] = useState<string | null>(null);

  const state = useAsync(async () => {
    const periods = await source.listProjectionPeriods();
    const active = period ?? periods[0]?.period ?? null;

    const [projections, leads, followUps, summary] = await Promise.all([
      active ? source.listProjections({ period: active, limit: 100 }) : null,
      source.listLeads({ openOnly: true, limit: 100 }),
      source.listFollowUps({ bucket: "upcoming", limit: 100 }),
      source.getHomeSummary(),
    ]);

    const rows = projections?.items ?? [];
    const committed = rows.reduce((sum, p) => sum + p.projectedValue, 0);
    const achieved = rows.reduce((sum, p) => sum + p.achievedValue, 0);

    // The previous period, for the delta. Absent for the oldest month on file,
    // in which case no delta is shown rather than a made-up 0%.
    const index = periods.findIndex((p) => p.period === active);
    const previous = index >= 0 ? periods[index + 1] : undefined;
    const previousRows = previous
      ? (await source.listProjections({ period: previous.period, limit: 100 })).items
      : [];
    const previousAchieved = previousRows.reduce((sum, p) => sum + p.achievedValue, 0);

    const delta =
      previousAchieved > 0
        ? ((achieved - previousAchieved) / previousAchieved) * 100
        : null;

    return {
      periods,
      active,
      committed,
      achieved,
      achievement: committed > 0 ? (achieved / committed) * 100 : 0,
      delta,
      pipelineValue: summary.openOpportunityValue,
      newSales: rows.filter((p) => p.achievedQty > 0).length,
      openOpportunities: leads.total,
      followUpsUpcoming: followUps.total,
    };
  }, [source, period]);

  const data = state.data;

  return (
    <Screen tabBarSpacing={false} bleed>
      <AppBar title="Sales Progress" />

      <View style={styles.body}>
        <SyntheticBanner />

        {state.loading || !data ? (
          <SkeletonList rows={3} />
        ) : (
          <>
            <Card
              style={styles.periodCard}
              onPress={() => {
                // Step through the periods on file rather than opening a
                // picker: there are three, and 07A owns real period selection.
                const i = data.periods.findIndex((p) => p.period === data.active);
                const next = data.periods[(i + 1) % Math.max(data.periods.length, 1)];
                if (next) setPeriod(next.period);
              }}
              accessibilityLabel={`Period, ${data.active ? periodLabel(data.active) : "none"}. Tap to change.`}
            >
              <View style={styles.periodRow}>
                <CalendarDays size={18} color={color.muted} strokeWidth={2} />
                <Text variant="cardTitle" style={styles.periodLabel}>
                  {data.active ? periodLabel(data.active) : "No period"}
                </Text>
              </View>
            </Card>

            <View style={styles.achievement}>
              <Text variant="caption" tone="muted" align="center">
                Achievement
              </Text>
              <Text style={styles.achievementValue} align="center">
                {percent(data.achievement)}
              </Text>
              <Text variant="cardTitle" tone="primaryDark" align="center">
                {moneyShort(data.achieved)} / {moneyShort(data.committed)}
              </Text>
            </View>

            {data.delta != null ? (
              <Panel tone="mint" style={styles.delta}>
                <View style={styles.deltaRow}>
                  {data.delta >= 0 ? (
                    <TrendingUp size={17} color={color.primaryDark} strokeWidth={2} />
                  ) : (
                    <TrendingDown size={17} color={color.redDark} strokeWidth={2} />
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
              <Tile value={moneyShort(data.committed)} label="Committed Value" />
              <Tile value={moneyShort(data.achieved)} label="Achieved Value" />
              <Tile value={moneyShort(data.pipelineValue)} label="Pipeline Value" />
              <Tile value={String(data.newSales)} label="New Sales" />
              <Tile value={String(data.openOpportunities)} label="Opportunities" />
              <Tile value={String(data.followUpsUpcoming)} label="Due This Week" />
            </View>

            <Button
              label="View Detailed Breakdown"
              block
              icon={<ArrowRight size={17} color={color.surfaceWhite} strokeWidth={2.5} />}
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
  deltaRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
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
