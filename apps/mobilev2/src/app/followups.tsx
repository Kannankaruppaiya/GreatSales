/**
 * 02C — Follow-ups.
 *
 * From the Penpot boards "02C.1 Follow-ups Overview" through "02C.4": a search
 * field, the four bucket chips with their counts, and either the three summary
 * cards (when no bucket is chosen) or the matching follow-up list.
 *
 * 02C.2 to 02C.4 are the same screen with a different bucket selected, so they
 * are one route with a filter rather than three near-identical screens.
 *
 * "Completed" is on the rail as well. Without it, a follow-up marked done
 * vanishes from the app entirely, and "did I already call them?" has no answer.
 */
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  AlarmClock,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react-native";

import { SearchBarButton } from "@/components/ui/SearchBar";

import {
  AppBar,
  Avatar,
  Card,
  Chip,
  EmptyState,
  ListFooter,
  Screen,
  SearchBar,
  SkeletonList,
  Text,
} from "@/components/ui";
import { QuoteBand } from "@/components/brand/QuoteBand";
import { useData } from "@/data/provider";
import type { FollowUpBucket } from "@/data/source";
import { color, font, space } from "@/design/tokens";
import { daysOverdue, dueLabel, moneyShort } from "@/lib/format";
import { useAsync, usePagedList } from "@/lib/useAsync";

/** The three that are work waiting. "completed" is on the rail but not summarised. */
type VisibleBucket = Extract<FollowUpBucket, "overdue" | "today" | "upcoming">;

const BUCKETS: {
  key: VisibleBucket;
  label: string;
  tone: "red" | "amber" | "mint";
}[] = [
  { key: "overdue", label: "Overdue", tone: "red" },
  { key: "today", label: "Today", tone: "amber" },
  { key: "upcoming", label: "Upcoming", tone: "mint" },
];

const BUCKET_BLURB: Record<FollowUpBucket, string> = {
  overdue: "Past due. Take action now.",
  today: "Scheduled for today.",
  upcoming: "Coming up after today.",
  completed: "Already done.",
  open: "Everything still to do.",
  week: "Due in the next seven days.",
};

export default function FollowUpsScreen() {
  const router = useRouter();
  const source = useData();

  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<FollowUpBucket | null>(null);
  const [sort, setSort] = useState<"soonest" | "latest">("soonest");

  const state = useAsync(async () => {
    const [overdue, today, upcoming] = await Promise.all([
      source.listFollowUps({ bucket: "overdue", limit: 1 }),
      source.listFollowUps({ bucket: "today", limit: 1 }),
      source.listFollowUps({ bucket: "upcoming", limit: 1 }),
    ]);
    return {
      counts: {
        overdue: overdue.total,
        today: today.total,
        upcoming: upcoming.total,
        all: overdue.total + today.total + upcoming.total,
      },
    };
  }, [source]);
  // "All" is all open work — the same set the All count adds up; completed
  // tasks have their own chip.
  const list = usePagedList(
    (cursor) =>
      source.listFollowUps({
        bucket: bucket ?? "open",
        search: search || undefined,
        sort,
        cursor,
        limit: 30,
      }),
    [source, bucket, search, sort],
  );

  const data = state.data;
  const reloadAll = () => {
    state.reload();
    list.reload();
  };
  const showSummary = bucket == null && search.length === 0;

  return (
    <Screen
      onRefresh={reloadAll}
      refreshing={state.refreshing || list.refreshing}
      error={state.error ?? list.error}
      bleed
    >
      <AppBar title="Follow-ups Due" />

      <View style={styles.body}>
        <View style={styles.searchRow}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search customers or follow-ups"
            trailing={
              <SearchBarButton
                accessibilityLabel={`Sort: ${sort === "latest" ? "latest first" : "soonest first"}. Tap to change.`}
                onPress={() =>
                  setSort(sort === "latest" ? "soonest" : "latest")
                }
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
          contentContainerStyle={styles.chipRail}
        >
          <Chip
            label="All"
            count={data?.counts.all ?? 0}
            active={bucket == null}
            onPress={() => setBucket(null)}
          />
          {BUCKETS.map((b) => (
            <Chip
              key={b.key}
              label={b.label}
              count={data?.counts[b.key] ?? 0}
              tone={b.tone}
              active={bucket === b.key}
              onPress={() => setBucket(bucket === b.key ? null : b.key)}
            />
          ))}
          {/* Completed sits on the rail but not in the summary above: it is
              history to look back at, not work waiting to be done. */}
          <Chip
            label="Completed"
            active={bucket === "completed"}
            onPress={() =>
              setBucket(bucket === "completed" ? null : "completed")
            }
          />
        </ScrollView>

        {state.loading || !data || (!showSummary && list.loading) ? (
          <SkeletonList rows={3} />
        ) : showSummary ? (
          <View style={styles.summary}>
            {BUCKETS.map((b) => (
              <Card
                key={b.key}
                tone={b.key === "overdue" ? "red" : "none"}
                onPress={() => setBucket(b.key)}
                accessibilityLabel={`${b.label}, ${data.counts[b.key]}`}
              >
                <View style={styles.summaryRow}>
                  <BucketIcon bucket={b.key} />
                  <View style={styles.summaryText}>
                    <Text
                      variant="cardTitle"
                      tone={b.key === "overdue" ? "redDark" : "ink"}
                    >
                      {b.key === "overdue" ? "Overdue Follow-ups" : b.label}
                    </Text>
                    <Text
                      variant="secondary"
                      tone={b.key === "overdue" ? "redDark" : "muted"}
                    >
                      {BUCKET_BLURB[b.key]}
                    </Text>
                  </View>
                  <Text
                    variant="hero"
                    tone={
                      b.tone === "red"
                        ? "red"
                        : b.tone === "amber"
                          ? "amber"
                          : "primary"
                    }
                  >
                    {data.counts[b.key]}
                  </Text>
                  <ChevronRight
                    size={16}
                    color={color.muted2}
                    strokeWidth={2}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : list.items.length > 0 ? (
          <View style={styles.list}>
            {list.items.map((followUp) => {
              // A finished task is not late, whatever its date was.
              const late = followUp.done ? 0 : daysOverdue(followUp.dueAt);
              return (
                <Card
                  key={followUp.id}
                  onPress={() => router.push(`/followup/${followUp.id}`)}
                  accessibilityLabel={`${followUp.customerName}, ${followUp.purpose}`}
                  style={styles.rowCard}
                >
                  {/* Board 02C.2: avatar, name, the second line, a status pill,
                      the amount top-right, and the task under a hairline. */}
                  <View style={styles.row}>
                    <Avatar name={followUp.customerName} size={39} />
                    <View style={styles.rowText}>
                      <View style={styles.titleRow}>
                        <Text
                          variant="cardTitle"
                          numberOfLines={1}
                          style={styles.flex}
                        >
                          {followUp.customerName}
                        </Text>
                        {followUp.amount != null ? (
                          <Text style={styles.amount}>
                            {moneyShort(followUp.amount)}
                          </Text>
                        ) : null}
                        <ChevronRight
                          size={16}
                          color={color.muted2}
                          strokeWidth={2}
                        />
                      </View>
                      {followUp.subtitle ? (
                        <Text
                          variant="secondary"
                          tone="muted"
                          numberOfLines={1}
                        >
                          {followUp.subtitle}
                        </Text>
                      ) : null}
                      <View
                        style={[
                          styles.pill,
                          late > 0
                            ? styles.pillLate
                            : followUp.done
                              ? styles.pillDone
                              : styles.pillDue,
                        ]}
                      >
                        {late > 0 ? (
                          <AlarmClock
                            size={12}
                            color={color.red}
                            strokeWidth={2.2}
                          />
                        ) : (
                          <CalendarDays
                            size={12}
                            color={
                              followUp.done ? color.primaryDark : color.steel
                            }
                            strokeWidth={2.2}
                          />
                        )}
                        <Text
                          style={[
                            styles.pillText,
                            {
                              color:
                                late > 0
                                  ? color.red
                                  : followUp.done
                                    ? color.primaryDark
                                    : color.steel,
                            },
                          ]}
                        >
                          {late > 0
                            ? `${late} ${late === 1 ? "day" : "days"} overdue`
                            : followUp.done
                              ? "Done"
                              : dueLabel(followUp.dueAt)}
                        </Text>
                      </View>
                      <View style={styles.hairline} />
                      <Text variant="secondary" tone="muted" numberOfLines={2}>
                        {followUp.purpose}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}
            <ListFooter
              shown={list.items.length}
              total={list.total}
              hasMore={list.hasMore}
              loadingMore={list.loadingMore}
              onLoadMore={list.loadMore}
              noun="follow-ups"
            />
          </View>
        ) : list.error ? null : (
          <EmptyState
            title="Nothing here"
            body={
              search
                ? "No follow-up matches that search. Try a shorter one."
                : "This bucket is clear. Schedule the next conversation from a customer or an opportunity."
            }
            actionLabel="Add Follow-up"
            onAction={() => router.push("/followup/new")}
          />
        )}

        <QuoteBand />
      </View>
    </Screen>
  );
}

/** The bucket rows' leading icons, in each bucket's own colour (02C.1). */
function BucketIcon({ bucket }: { bucket: VisibleBucket }) {
  if (bucket === "overdue")
    return <AlarmClock size={24} color={color.red} strokeWidth={2} />;
  if (bucket === "today")
    return <CalendarDays size={24} color={color.amber} strokeWidth={2} />;
  return <CalendarRange size={24} color={color.primary} strokeWidth={2} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  amount: { fontFamily: font.extrabold, fontSize: 14, color: color.ink },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  pillLate: { backgroundColor: "#FDEDED" },
  pillDue: { backgroundColor: color.steelSoft },
  pillDone: { backgroundColor: color.mintSurface },
  pillText: { fontFamily: font.bold, fontSize: 11 },
  hairline: {
    height: 1,
    backgroundColor: color.lineSoft,
    marginVertical: space.sm,
  },
  body: { paddingHorizontal: space.gutter },
  searchRow: { marginTop: space.md },
  chipRail: { gap: space.sm, paddingVertical: space.xl },
  summary: { gap: space.md },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    minHeight: 41,
  },
  summaryText: { flex: 1, gap: 2 },
  list: { gap: space.md },
  rowCard: { padding: space.lg },
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  rowText: { flex: 1, gap: 2 },
});
