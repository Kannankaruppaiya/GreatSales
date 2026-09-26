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
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  SlidersHorizontal,
  Target,
} from "lucide-react-native";

import {
  AppBar,
  Chip,
  EmptyState,
  ListFooter,
  Screen,
  SearchBar,
  SearchBarButton,
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
import { DealRow } from "@/components/ui/DealRow";
import { color, font, space } from "@/design/tokens";
import { moneyShort, percent } from "@/lib/format";
import { DEAL_STAGE_LABELS, DEAL_STAGE_TONES, isOpenStage } from "@/lib/labels";
import { useAsync, usePagedList } from "@/lib/useAsync";
import type { DealStageValue } from "@greatsales/shared";

export default function PipelineScreen() {
  const router = useRouter();
  const source = useData();

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
      <View style={styles.bleed}>
        <AppBar
          title="Pipeline"
          showBack={false}
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="All stages"
              onPress={() => router.push("/stages")}
              hitSlop={12}
            >
              <ClipboardList size={22} color={color.ink} strokeWidth={2} />
            </Pressable>
          }
        />
      </View>

      <View style={styles.searchRow}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search opportunities"
          trailing={
            <SearchBarButton
              accessibilityLabel={
                active > 0 ? `Filters, ${active} applied` : "Filters"
              }
              onPress={() => setFiltersOpen(true)}
              badge={active}
            >
              <SlidersHorizontal
                size={19}
                color={color.inkDeep}
                strokeWidth={2}
              />
            </SearchBarButton>
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

      {/* Board 03.1: the two headline figures of the open pipeline. */}
      <View style={styles.stats}>
        <Stat
          Icon={Target}
          value={moneyShort(totalValue)}
          label="Total Value"
        />
        <Stat
          Icon={BarChart3}
          value={String(totalOpen)}
          label="Opportunities"
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sorted by ${SORT_LABELS[sort]}. Tap to change.`}
        onPress={() => setSortOpen(true)}
        style={styles.sortRow}
      >
        <Text style={styles.sortText}>Sort: {SORT_LABELS[sort]}</Text>
        <ChevronDown size={14} color={color.muted} strokeWidth={2} />
      </Pressable>

      {leads.loading ? (
        <SkeletonList rows={4} />
      ) : leads.items.length > 0 ? (
        <View style={styles.list}>
          {leads.items.map((lead) => (
            <DealRow
              key={lead.id}
              lead={lead}
              onPress={() => router.push(`/lead/${lead.id}`)}
            />
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

/** A headline figure on a mint tile, with its icon on a white plate (03.1). */
function Stat({
  Icon,
  value,
  label,
}: {
  Icon: typeof Target;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statPlate}>
        <Icon size={16} color={color.primary} strokeWidth={2.2} />
      </View>
      <View style={styles.statText}>
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

/** Kept for the detail screens that show a probability against a deal. */
export const formatProbability = percent;

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -space.gutter },
  stats: { flexDirection: "row", gap: space.sm },
  stat: {
    flex: 1,
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCEFE4",
    backgroundColor: color.mintTint,
  },
  statPlate: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#DCEFE4",
    backgroundColor: color.surfaceWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  statText: { flex: 1 },
  statValue: { fontFamily: font.extrabold, fontSize: 16, color: color.ink },
  statLabel: { fontFamily: font.semibold, fontSize: 10, color: color.muted },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  sortText: { fontFamily: font.semibold, fontSize: 11, color: color.muted },
  searchRow: { marginTop: space.md },
  stageRail: { gap: space.sm, paddingVertical: space.lg },
  list: { gap: 14 },
});
