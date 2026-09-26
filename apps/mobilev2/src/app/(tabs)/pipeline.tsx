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
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronDown,
  ClipboardList,
  SlidersHorizontal,
} from "lucide-react-native";

import {
  Avatar,
  Card,
  Chip,
  EmptyState,
  ListFooter,
  Panel,
  Screen,
  SearchBar,
  SkeletonList,
  Text,
} from "@/components/ui";
import {
  PipelineFiltersSheet,
  SortSheet,
  SORT_LABELS,
  NO_FILTERS,
  closureCutoff,
  filterCount,
  type LeadSort,
  type PipelineFilters,
} from "@/components/modals";
import { useData } from "@/data/provider";
import { color, space } from "@/design/tokens";
import { longDate, moneyShort, percent } from "@/lib/format";
import { DEAL_STAGE_LABELS, DEAL_STAGE_TONES, isOpenStage } from "@/lib/labels";
import { useAsync, usePagedList } from "@/lib/useAsync";
import type { DealStageValue } from "@greatsales/shared";

export default function PipelineScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  // 03.2 routes here with a stage already chosen, so the rail opens on it.
  const params = useLocalSearchParams<{ stage?: string }>();

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<DealStageValue | null>(
    (params.stage as DealStageValue | undefined) ?? null,
  );
  const [filters, setFilters] = useState<PipelineFilters>(NO_FILTERS);
  const [sort, setSort] = useState<LeadSort>("closeDate");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const active = filterCount(filters);

  // The whole funnel in one call: the rail and the header take the open slice
  // of it, the filter sheet wants the closed stages too.
  const state = useAsync(
    async () => ({ stages: await source.getPipelineStageCounts() }),
    [source],
  );
  const leads = usePagedList(
    (cursor) =>
      source.listLeads({
        search: search || undefined,
        // The rail picks one stage; the sheet can pick several. When the rail
        // is set it wins, so tapping a chip does what it looks like it does.
        stage: stage ?? undefined,
        stages:
          stage == null && filters.stages.length ? filters.stages : undefined,
        closeBefore: filters.closure
          ? closureCutoff(filters.closure)
          : undefined,
        openOnly: stage == null && filters.openOnly,
        sort,
        cursor,
        // Value order is a ranked top-N with no next page, so it asks for the
        // most the API will return in one go.
        limit: sort === "value" ? 100 : 30,
      }),
    [source, search, stage, filters, sort],
  );
  const reloadAll = () => {
    state.reload();
    leads.reload();
  };

  const openStages = useMemo(
    () => state.data?.stages.filter((s) => isOpenStage(s.stage)) ?? [],
    [state.data],
  );
  const totalOpen = useMemo(
    () => openStages.reduce((sum, s) => sum + s.count, 0),
    [openStages],
  );
  const totalValue = useMemo(
    () => openStages.reduce((sum, s) => sum + s.value, 0),
    [openStages],
  );

  return (
    <Screen
      onRefresh={reloadAll}
      refreshing={state.refreshing || leads.refreshing}
      error={state.error ?? leads.error}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.headerText}>
          <Text variant="pageTitle">Pipeline</Text>
          <Text variant="caption" tone="muted">
            {totalOpen} open · {moneyShort(totalValue)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="All stages"
          onPress={() => router.push("/stages")}
          hitSlop={12}
        >
          <ClipboardList size={21} color={color.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search opportunities"
          trailing={
            <Chip
              label={active > 0 ? `Filters (${active})` : "Filters"}
              tone="neutral"
              active={active > 0}
              onPress={() => setFiltersOpen(true)}
              icon={
                <SlidersHorizontal
                  size={13}
                  color={active > 0 ? color.surfaceWhite : color.muted}
                  strokeWidth={2}
                />
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
        {/* A chip for a stage holding nothing filters to an empty list, so it
            is left off the rail. 03.2 is where the whole funnel is shown. */}
        {openStages
          .filter((entry) => entry.count > 0 || entry.stage === stage)
          .map((entry) => (
            <Chip
              key={entry.stage}
              label={DEAL_STAGE_LABELS[entry.stage]}
              count={entry.count}
              tone={DEAL_STAGE_TONES[entry.stage]}
              active={stage === entry.stage}
              onPress={() =>
                setStage(stage === entry.stage ? null : entry.stage)
              }
            />
          ))}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sorted by ${SORT_LABELS[sort]}. Tap to change.`}
        onPress={() => setSortOpen(true)}
        style={styles.sortRow}
      >
        <Text variant="caption" tone="muted">
          Sorted by:
        </Text>
        <Text variant="secondary" style={styles.sortValue}>
          {SORT_LABELS[sort]}
        </Text>
        <ChevronDown size={14} color={color.muted} strokeWidth={2} />
      </Pressable>

      {leads.loading ? (
        <SkeletonList rows={4} />
      ) : leads.items.length > 0 ? (
        <View style={styles.list}>
          {leads.items.map((lead) => (
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
                    {lead.products[0]?.productName ??
                      lead.area ??
                      "No products yet"}
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

          <ListFooter
            shown={leads.items.length}
            total={leads.total}
            hasMore={leads.hasMore}
            loadingMore={leads.loadingMore}
            onLoadMore={leads.loadMore}
            noun={sort === "value" ? "deals, most valuable first" : "deals"}
          />
        </View>
      ) : leads.error ? null : (
        <EmptyState
          title="No opportunities here"
          body={
            search || stage || active > 0
              ? "Clear the search or the filters to see the rest of your pipeline."
              : "Capture your next conversation as a lead and it will show up here."
          }
          actionLabel={
            search || stage || active > 0 ? "Clear filters" : "New Sales Lead"
          }
          onAction={() => {
            if (search || stage || active > 0) {
              setSearch("");
              setStage(null);
              setFilters(NO_FILTERS);
            } else {
              router.push("/lead/new");
            }
          }}
        />
      )}

      <PipelineFiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={filters}
        onApply={setFilters}
        stageCounts={state.data?.stages}
      />
      <SortSheet
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        value={sort}
        onChange={setSort}
      />
    </Screen>
  );
}

/** Kept for the detail screens that show a probability against a deal. */
export const formatProbability = percent;

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: space.sm,
    gap: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingBottom: space.lg,
  },
  sortValue: { flex: 1 },
  searchRow: { marginTop: space.md },
  stageRail: { gap: space.sm, paddingTop: space.xl, paddingBottom: space.lg },
  list: { gap: space.xl },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  cardHeadText: { flex: 1, gap: 2 },
  panelRow: { flexDirection: "row", gap: space.md, marginTop: space.lg },
  panel: { flex: 1, gap: 2 },
});
