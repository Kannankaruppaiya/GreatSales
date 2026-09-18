/**
 * 02C — Follow-ups.
 *
 * From the Penpot boards "02C.1 Follow-ups Overview" through "02C.4": a search
 * field, the four bucket chips with their counts, and either the three summary
 * cards (when no bucket is chosen) or the matching follow-up list.
 *
 * 02C.2 to 02C.4 are the same screen with a different bucket selected, so they
 * are one route with a filter rather than three near-identical screens.
 */
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SlidersHorizontal } from "lucide-react-native";

import {
  AppBar,
  Avatar,
  Card,
  Chip,
  EmptyState,
  Screen,
  SearchBar,
  SkeletonList,
  StatusDot,
  SyntheticBanner,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import type { FollowUpBucket } from "@/data/source";
import { color, space } from "@/design/tokens";
import { daysOverdue, dueLabel, timeOfDay } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/** The three buckets this screen offers. "completed" is history, reached from a customer. */
type VisibleBucket = Extract<FollowUpBucket, "overdue" | "today" | "upcoming">;

const BUCKETS: { key: VisibleBucket; label: string; tone: "red" | "amber" | "mint" }[] = [
  { key: "overdue", label: "Overdue", tone: "red" },
  { key: "today", label: "Today", tone: "amber" },
  { key: "upcoming", label: "Upcoming", tone: "mint" },
];

const BUCKET_BLURB: Record<FollowUpBucket, string> = {
  overdue: "Past due. Take action now.",
  today: "Scheduled for today.",
  upcoming: "Next 7 days.",
  completed: "Already done.",
};

export default function FollowUpsScreen() {
  const router = useRouter();
  const source = useData();

  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<VisibleBucket | null>(null);

  const state = useAsync(async () => {
    const [overdue, today, upcoming, list] = await Promise.all([
      source.listFollowUps({ bucket: "overdue", limit: 1 }),
      source.listFollowUps({ bucket: "today", limit: 1 }),
      source.listFollowUps({ bucket: "upcoming", limit: 1 }),
      source.listFollowUps({
        bucket: bucket ?? undefined,
        search: search || undefined,
        limit: 40,
      }),
    ]);
    return {
      counts: {
        overdue: overdue.total,
        today: today.total,
        upcoming: upcoming.total,
        all: overdue.total + today.total + upcoming.total,
      },
      list,
    };
  }, [source, bucket, search]);

  const data = state.data;
  const showSummary = bucket == null && search.length === 0;

  return (
    <Screen onRefresh={state.reload} refreshing={state.refreshing} bleed>
      <AppBar title="Follow-ups Due" showBack={false} />

      <View style={styles.body}>
        <SyntheticBanner />

        <View style={styles.searchRow}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search customers or follow-ups"
            trailing={
              <Chip
                label="Sort"
                tone="neutral"
                onPress={() => router.push("/followups/filters")}
                icon={<SlidersHorizontal size={13} color={color.muted} strokeWidth={2} />}
              />
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
        </ScrollView>

        {state.loading || !data ? (
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
                    tone={b.tone === "red" ? "red" : b.tone === "amber" ? "amber" : "primary"}
                  >
                    {data.counts[b.key]}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        ) : data.list.items.length > 0 ? (
          <View style={styles.list}>
            {data.list.items.map((followUp) => {
              const late = daysOverdue(followUp.dueAt);
              return (
                <Card
                  key={followUp.id}
                  onPress={() => router.push(`/followup/${followUp.id}`)}
                  accessibilityLabel={`${followUp.customerName}, ${followUp.purpose}`}
                  style={styles.rowCard}
                >
                  <View style={styles.row}>
                    <View style={styles.when}>
                      <StatusDot tone={late > 0 ? "red" : "mint"} />
                      <Text variant="micro" tone={late > 0 ? "redDark" : "muted"}>
                        {dueLabel(followUp.dueAt)}
                      </Text>
                      {late > 0 ? (
                        <Text variant="nano" tone="redDark">
                          {late}d late
                        </Text>
                      ) : (
                        <Text variant="nano" tone="muted2">
                          {timeOfDay(followUp.dueAt)}
                        </Text>
                      )}
                    </View>
                    <Avatar name={followUp.customerName} size={36} />
                    <View style={styles.rowText}>
                      <Text variant="cardTitle" numberOfLines={1}>
                        {followUp.customerName}
                      </Text>
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {followUp.purpose}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}
            {data.list.total > data.list.items.length ? (
              <Text variant="caption" tone="muted2" align="center">
                Showing {data.list.items.length} of {data.list.total}
              </Text>
            ) : null}
          </View>
        ) : (
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter },
  searchRow: { marginTop: space.md },
  chipRail: { gap: space.sm, paddingVertical: space.xl },
  summary: { gap: space.md },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  summaryText: { flex: 1, gap: 2 },
  list: { gap: space.md },
  rowCard: { padding: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  when: { width: 62, gap: 3 },
  rowText: { flex: 1, gap: 2 },
});
