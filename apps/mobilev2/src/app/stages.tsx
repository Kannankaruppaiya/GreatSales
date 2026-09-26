/**
 * 03.2 — All Stages.
 *
 * From the Penpot board of the same name: one row per pipeline stage with its
 * tile, its count and the value sitting in it, tapping through to the pipeline
 * list filtered to that stage.
 *
 * Every stage the source reports is listed, including the ones holding nothing
 * — a funnel with a step missing reads as a funnel with fewer steps. The rows
 * follow the funnel's own order rather than sorting by size, because the point
 * of this screen is the shape of the funnel.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import type { DealStageValue } from "@greatsales/shared";

import {
  AppBar,
  Card,
  EmptyState,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { PromoCard } from "@/components/brand/PromoCard";
import { useData } from "@/data/provider";
import { color, radius, space } from "@/design/tokens";
import { moneyShort } from "@/lib/format";
import { DEAL_STAGE_LABELS } from "@/lib/labels";
import { stageVisual } from "@/lib/stage-visuals";
import { useAsync } from "@/lib/useAsync";

export default function AllStagesScreen() {
  const router = useRouter();
  const source = useData();

  const state = useAsync(async () => {
    // Every stage, closed ones included — they are the point of the screen.
    const rows = await source.getPipelineStageCounts();
    return { rows, total: rows.reduce((sum, r) => sum + r.count, 0) };
  }, [source]);

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="All Stages" />

      <View style={styles.body}>
        {state.loading || !state.data ? (
          <SkeletonList rows={6} />
        ) : state.data.total === 0 ? (
          <EmptyState
            title="Nothing in the pipeline yet"
            body="Create your first opportunity and the stages will start filling up."
            actionLabel="New Sales Lead"
            onAction={() => router.push("/lead/new")}
          />
        ) : (
          <View style={styles.list}>
            {state.data.rows.map((row) => (
              <StageRow
                key={row.stage}
                stage={row.stage}
                count={row.count}
                value={row.value}
                onPress={() =>
                  router.push(`/(tabs)/pipeline?stage=${row.stage}`)
                }
              />
            ))}
            <PromoCard />
          </View>
        )}
      </View>
    </Screen>
  );
}

function StageRow({
  stage,
  count,
  value,
  onPress,
}: {
  stage: DealStageValue;
  count: number;
  value: number;
  onPress: () => void;
}) {
  const visual = stageVisual(stage);
  const label = DEAL_STAGE_LABELS[stage];

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${label}, ${count} ${count === 1 ? "opportunity" : "opportunities"}, ${moneyShort(value)}`}
      style={styles.row}
    >
      <View style={styles.rowInner}>
        <View style={[styles.tile, { backgroundColor: visual.bg }]}>
          <visual.Icon size={20} color={visual.fg} strokeWidth={2} />
        </View>

        <View style={styles.rowText}>
          <Text variant="cardTitle" numberOfLines={1}>
            {label}
          </Text>
          <Text variant="caption" tone="muted">
            {count} {count === 1 ? "opportunity" : "opportunities"}
          </Text>
        </View>

        <Text variant="cardTitle">{moneyShort(value)}</Text>
        <ChevronRight size={14} color={color.muted2} strokeWidth={2} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter },
  list: { gap: space.md, marginTop: space.sm },
  row: { paddingVertical: space.md },
  rowInner: { flexDirection: "row", alignItems: "center", gap: space.md },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
});
