/**
 * 03E.2 — Opportunity Activity.
 *
 * The full timeline for one opportunity, from the Penpot board of the same
 * name: type chips across the top with counts, rows grouped under a date
 * heading, and a connector line running down behind the icons.
 *
 * The connector is drawn per group rather than once down the whole screen, so
 * it stops at the last row of a day instead of running through the next date
 * heading — which is how the board draws it.
 */
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ListFilter } from "lucide-react-native";

import {
  AppBar,
  Avatar,
  Chip,
  EmptyState,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import {
  ActivityFiltersSheet,
  NO_ACTIVITY_FILTERS,
  activityFilterCount,
  type ActivityFilters,
} from "@/components/modals";
import { useData } from "@/data/provider";
import type { Activity } from "@/data/source";
import { color, radius, space } from "@/design/tokens";
import { isDayOnly, timeOfDay } from "@/lib/format";
import {
  ACTIVITY_CHIP_LABELS,
  ACTIVITY_GROUP_ORDER,
  ACTIVITY_ICONS,
  activityGroup,
  groupByDay,
  rangeCutoff,
  type ActivityGroup,
} from "@/lib/activity";
import { useAsync } from "@/lib/useAsync";

export default function ActivityTimelineScreen() {
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const router = useRouter();
  const source = useData();

  const [filters, setFilters] = useState<ActivityFilters>(NO_ACTIVITY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chip, setChip] = useState<ActivityGroup | null>(null);

  const state = useAsync(async () => {
    if (!leadId) return { rows: [] as Activity[] };
    const rows = await source.listActivities({
      entityType: "Lead",
      entityId: leadId,
    });
    return { rows };
  }, [source, leadId]);

  const rows = state.data?.rows ?? [];

  // Counts are over the unfiltered timeline, so a chip never reads zero while
  // its own filter is the thing hiding the rows.
  const counts = useMemo(() => {
    const out: Record<ActivityGroup, number> = {
      stage: 0,
      followup: 0,
      note: 0,
      other: 0,
    };
    for (const row of rows) out[activityGroup(row.kind)] += 1;
    return out;
  }, [rows]);

  const visible = useMemo(() => {
    const cutoff = rangeCutoff(filters.range);
    const wanted = chip ? [chip] : filters.groups;
    return rows.filter((row) => {
      if (cutoff && row.at < cutoff) return false;
      if (wanted.length && !wanted.includes(activityGroup(row.kind)))
        return false;
      return true;
    });
  }, [rows, filters, chip]);

  const days = useMemo(() => groupByDay(visible), [visible]);
  const active = activityFilterCount(filters);

  return (
    <Screen
      tabBarSpacing
      bleed
      onRefresh={state.reload}
      refreshing={state.refreshing}
    >
      <AppBar
        title="Opportunity Activity"
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              active > 0 ? `Filters, ${active} applied` : "Filters"
            }
            onPress={() => setSheetOpen(true)}
            hitSlop={12}
          >
            <ListFilter
              size={20}
              color={active > 0 ? color.primary : color.ink}
              strokeWidth={2}
            />
          </Pressable>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip label="All" active={chip == null} onPress={() => setChip(null)} />
        {/* A chip for a type with no rows filters to nothing, so it is left
            off. The filter sheet still lists every type, with its count. */}
        {ACTIVITY_GROUP_ORDER.filter((group) => counts[group] > 0).map(
          (group) => (
            <Chip
              key={group}
              label={ACTIVITY_CHIP_LABELS[group]}
              count={counts[group]}
              active={chip === group}
              onPress={() => setChip(chip === group ? null : group)}
            />
          ),
        )}
      </ScrollView>

      <View style={styles.body}>
        {state.loading ? (
          <SkeletonList rows={5} />
        ) : days.length === 0 ? (
          <EmptyState
            title={
              rows.length === 0
                ? "No activity yet"
                : "Nothing matches these filters"
            }
            body={
              rows.length === 0
                ? "Calls, notes and stage changes on this opportunity will appear here."
                : "Widen the date range or clear the type filters to see the rest."
            }
            actionLabel={rows.length === 0 ? undefined : "Clear filters"}
            onAction={
              rows.length === 0
                ? undefined
                : () => {
                    setFilters(NO_ACTIVITY_FILTERS);
                    setChip(null);
                  }
            }
          />
        ) : (
          days.map((day) => (
            <View key={day.key} style={styles.day}>
              <Text variant="secondary" style={styles.heading}>
                {day.heading}
              </Text>

              {day.rows.map((row, index) => (
                <TimelineRow
                  key={row.id}
                  row={row}
                  /* The connector stops at the last row of the day. */
                  connected={index < day.rows.length - 1}
                  onPress={() => router.push(`/activity/item/${row.id}`)}
                />
              ))}
            </View>
          ))
        )}
      </View>

      <ActivityFiltersSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={filters}
        onApply={(next) => {
          setFilters(next);
          // The sheet is the fuller control, so it takes over from the chip
          // rather than the two silently intersecting.
          setChip(null);
        }}
        counts={counts}
      />
    </Screen>
  );
}

function TimelineRow({
  row,
  connected,
  onPress,
}: {
  row: Activity;
  connected: boolean;
  onPress: () => void;
}) {
  const group = activityGroup(row.kind);
  const Icon = ACTIVITY_ICONS[group];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.kind}, ${row.summary}`}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.rail}>
        <View style={styles.plate}>
          <Icon size={16} color={color.primaryDark} strokeWidth={2} />
        </View>
        {connected ? <View style={styles.connector} /> : null}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <Text variant="caption" tone="primaryDark" style={styles.kind}>
            {row.kind}
          </Text>
          <Text variant="nano" tone="muted2">
            {isDayOnly(row.at) ? "Due" : timeOfDay(row.at)}
          </Text>
        </View>
        <Text variant="caption" tone="muted">
          {row.summary}
        </Text>
      </View>

      {row.actorName ? <Avatar name={row.actorName} size={18} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: {
    gap: space.sm,
    paddingHorizontal: space.gutter,
    paddingBottom: space.lg,
  },
  body: { paddingHorizontal: space.gutter, gap: space.xl },
  day: { gap: space.md },
  heading: { color: color.ink },
  row: { flexDirection: "row", gap: space.md },
  rail: { width: 34, alignItems: "center" },
  plate: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: color.mintTint,
    alignItems: "center",
    justifyContent: "center",
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: color.line,
    marginTop: space.xs,
  },
  rowBody: { flex: 1, gap: 3, paddingBottom: space.lg },
  rowHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  kind: { flex: 1 },
});
