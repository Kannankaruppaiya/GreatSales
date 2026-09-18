/**
 * 03 — Pipeline.
 *
 * From the Penpot boards "03.1 Pipeline Overview" and "03A.1 Pipeline List":
 * a stage rail across the top with counts, a search field, and the opportunity
 * stream below it. Selecting a stage filters the stream; "All" clears it.
 *
 * Stage counts come from the source's own aggregate, not from counting the
 * loaded page — a count that only reflects the first 20 rows is wrong as soon
 * as there are 21.
 */
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SlidersHorizontal } from "lucide-react-native";

import {
  Avatar,
  Card,
  Chip,
  EmptyState,
  Panel,
  Screen,
  SearchBar,
  SkeletonList,
  Text,
} from "@/components/ui";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";
import { useData } from "@/data/provider";
import { color, space } from "@/design/tokens";
import { longDate, moneyShort, percent } from "@/lib/format";
import { DEAL_STAGE_LABELS, DEAL_STAGE_TONES } from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";
import type { DealStageValue } from "@greatsales/shared";

export default function PipelineScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<DealStageValue | null>(null);

  const state = useAsync(async () => {
    const [stages, leads] = await Promise.all([
      source.getPipelineStageCounts(),
      source.listLeads({
        search: search || undefined,
        stage: stage ?? undefined,
        openOnly: stage == null,
        sort: "value",
        limit: 30,
      }),
    ]);
    return { stages, leads };
  }, [source, search, stage]);

  const totalOpen = useMemo(
    () => state.data?.stages.reduce((sum, s) => sum + s.count, 0) ?? 0,
    [state.data],
  );
  const totalValue = useMemo(
    () => state.data?.stages.reduce((sum, s) => sum + s.value, 0) ?? 0,
    [state.data],
  );

  return (
    <Screen onRefresh={state.reload} refreshing={state.refreshing}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text variant="pageTitle">Pipeline</Text>
        <Text variant="caption" tone="muted">
          {totalOpen} open · {moneyShort(totalValue)}
        </Text>
      </View>

      <SyntheticBanner />

      <View style={styles.searchRow}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search opportunities"
          trailing={
            <Chip
              label="Filters"
              tone="neutral"
              onPress={() => router.push("/pipeline/filters")}
              icon={
                <SlidersHorizontal size={13} color={color.muted} strokeWidth={2} />
              }
            />
          }
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stageRail}
      >
        <Chip
          label="All"
          count={totalOpen}
          active={stage == null}
          onPress={() => setStage(null)}
        />
        {state.data?.stages.map((entry) => (
          <Chip
            key={entry.stage}
            label={DEAL_STAGE_LABELS[entry.stage]}
            count={entry.count}
            tone={DEAL_STAGE_TONES[entry.stage]}
            active={stage === entry.stage}
            onPress={() => setStage(stage === entry.stage ? null : entry.stage)}
          />
        ))}
      </ScrollView>

      {state.loading ? (
        <SkeletonList rows={4} />
      ) : state.data && state.data.leads.items.length > 0 ? (
        <View style={styles.list}>
          {state.data.leads.items.map((lead) => (
            <Card
              key={lead.id}
              onPress={() => router.push(`/lead/${lead.id}`)}
              accessibilityLabel={`${lead.customerName}, ${moneyShort(lead.totalValue)}`}
            >
              <View style={styles.cardHead}>
                <Avatar name={lead.customerName} size={38} />
                <View style={styles.cardHeadText}>
                  <Text variant="cardTitle" numberOfLines={1}>
                    {lead.customerName}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {lead.products[0]?.productName ?? lead.area ?? "No products yet"}
                  </Text>
                </View>
                <Chip
                  label={DEAL_STAGE_LABELS[lead.stage]}
                  tone={DEAL_STAGE_TONES[lead.stage]}
                />
              </View>

              <View style={styles.panelRow}>
                <Panel style={styles.panel}>
                  <Text variant="nano" tone="muted">
                    Deal Value
                  </Text>
                  <Text variant="cardTitle">{moneyShort(lead.totalValue)}</Text>
                </Panel>
                <Panel style={styles.panel}>
                  <Text variant="nano" tone="muted">
                    Expected Close
                  </Text>
                  <Text variant="cardTitle">
                    {lead.expClose ? longDate(lead.expClose) : "Not set"}
                  </Text>
                </Panel>
              </View>
            </Card>
          ))}

          {state.data.leads.total > state.data.leads.items.length ? (
            <Text variant="caption" tone="muted2" align="center">
              Showing {state.data.leads.items.length} of {state.data.leads.total}
            </Text>
          ) : null}
        </View>
      ) : (
        <EmptyState
          title="No opportunities here"
          body={
            search || stage
              ? "Clear the search or stage filter to see the rest of your pipeline."
              : "Capture your next conversation as a lead and it will show up here."
          }
          actionLabel={search || stage ? "Clear filters" : "New Sales Lead"}
          onAction={() => {
            if (search || stage) {
              setSearch("");
              setStage(null);
            } else {
              router.push("/lead/new");
            }
          }}
        />
      )}
    </Screen>
  );
}

/** Kept for the detail screens that show a probability against a deal. */
export const formatProbability = percent;

const styles = StyleSheet.create({
  header: { paddingBottom: space.sm, gap: 2 },
  searchRow: { marginTop: space.md },
  stageRail: { gap: space.sm, paddingVertical: space.xl },
  list: { gap: space.xl },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  cardHeadText: { flex: 1, gap: 2 },
  panelRow: { flexDirection: "row", gap: space.md, marginTop: space.lg },
  panel: { flex: 1, gap: 2 },
});
