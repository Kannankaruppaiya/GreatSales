/**
 * 02D — Hot Opportunities.
 *
 * From the Penpot board "02D.1 Hot Opportunities Overview": two summary tiles,
 * probability band chips, and the ranked opportunity stream.
 *
 * "Hot" is not a stored flag — nothing in the product sets one. It is the open
 * pipeline sorted by value, banded by the probability the projections carry.
 * Deriving it means the count in the tile and the rows below always agree.
 */
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Flame, IndianRupee } from "lucide-react-native";

import {
  AppBar,
  Avatar,
  Card,
  Chip,
  EmptyState,
  Panel,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { color, font, space } from "@/design/tokens";
import { moneyShort, shortDate } from "@/lib/format";
import { DEAL_STAGE_LABELS, DEAL_STAGE_TONES } from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";

type Band = "all" | "high" | "medium" | "low";

/**
 * Probability comes from the projection attached to the deal's customer and
 * product where there is one. Without that the deal's stage is the best
 * estimate available, and the stage ladder is what the pipeline already uses.
 */
const STAGE_PROBABILITY: Record<string, number> = {
  NewEnquiries: 10,
  NeedsAnalysis: 25,
  TrialsAndSampleTests: 45,
  ProposalsAndPriceQuote: 60,
  NegotiationOralConfirmation: 80,
  TrialProblem: 30,
};

function bandOf(probability: number): Exclude<Band, "all"> {
  if (probability >= 70) return "high";
  if (probability >= 40) return "medium";
  return "low";
}

export default function HotOpportunitiesScreen() {
  const router = useRouter();
  const source = useData();
  const [band, setBand] = useState<Band>("all");

  const state = useAsync(
    () => source.listLeads({ openOnly: true, sort: "value", limit: 60 }),
    [source],
  );

  const scored = useMemo(
    () =>
      (state.data?.items ?? []).map((lead) => {
        const probability = STAGE_PROBABILITY[lead.stage] ?? 20;
        return { lead, probability, band: bandOf(probability) };
      }),
    [state.data],
  );

  const counts = useMemo(
    () => ({
      all: scored.length,
      high: scored.filter((s) => s.band === "high").length,
      medium: scored.filter((s) => s.band === "medium").length,
      low: scored.filter((s) => s.band === "low").length,
    }),
    [scored],
  );

  const shown = band === "all" ? scored : scored.filter((s) => s.band === band);
  const potential = shown.reduce((sum, s) => sum + s.lead.totalValue, 0);

  return (
    <Screen onRefresh={state.reload} refreshing={state.refreshing} bleed>
      <AppBar
        title="Hot Opportunities"
        subtitle="High-probability deals that need your focus."
      />

      <View style={styles.body}>
        <View style={styles.stats}>
          <Panel style={styles.stat}>
            <View style={styles.statRow}>
              <View style={styles.statPlate}>
                <Flame size={17} color={color.primaryDark} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.statValue}>{shown.length}</Text>
                <Text variant="micro" tone="muted">
                  Hot Opportunities
                </Text>
              </View>
            </View>
          </Panel>
          <Panel tone="steel" style={styles.stat}>
            <View style={styles.statRow}>
              <View style={[styles.statPlate, styles.statPlateLight]}>
                <IndianRupee size={17} color={color.steel} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.statValue}>{moneyShort(potential)}</Text>
                <Text variant="micro" tone="muted">
                  Potential Revenue
                </Text>
              </View>
            </View>
          </Panel>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRail}
        >
          <Chip
            label="All"
            count={counts.all}
            active={band === "all"}
            onPress={() => setBand("all")}
          />
          <Chip
            label="High"
            count={counts.high}
            active={band === "high"}
            onPress={() => setBand("high")}
          />
          <Chip
            label="Medium"
            count={counts.medium}
            active={band === "medium"}
            onPress={() => setBand("medium")}
          />
          <Chip
            label="Low"
            count={counts.low}
            active={band === "low"}
            onPress={() => setBand("low")}
          />
        </ScrollView>

        {state.loading ? (
          <SkeletonList rows={5} />
        ) : shown.length > 0 ? (
          <Card flush style={styles.listCard}>
            {shown.map((entry, i) => (
              <React.Fragment key={entry.lead.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                {/* A Pressable, not a Card: the design forbids a card inside a
                    card ("never a shadow inside a shadow"). */}
                <Pressable
                  onPress={() => router.push(`/lead/${entry.lead.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.lead.customerName}, ${moneyShort(entry.lead.totalValue)}`}
                  style={({ pressed }) => [
                    styles.entry,
                    pressed ? styles.entryPressed : null,
                  ]}
                >
                  <View style={styles.entryHead}>
                    <Avatar name={entry.lead.customerName} size={39} />
                    <View style={styles.entryText}>
                      <Text variant="cardTitle" numberOfLines={1}>
                        {entry.lead.customerName}
                      </Text>
                      <Text variant="secondary" tone="muted" numberOfLines={1}>
                        {entry.lead.products[0]?.productName ??
                          "No products yet"}
                      </Text>
                    </View>
                    <Text style={styles.entryValue}>
                      {moneyShort(entry.lead.totalValue)}
                    </Text>
                  </View>
                  <View style={styles.entryChips}>
                    <Chip
                      label={`${entry.probability}%`}
                      tone={
                        entry.band === "high"
                          ? "red"
                          : entry.band === "medium"
                            ? "amber"
                            : "neutral"
                      }
                    />
                    <Chip
                      label={DEAL_STAGE_LABELS[entry.lead.stage]}
                      tone={DEAL_STAGE_TONES[entry.lead.stage]}
                    />
                    {entry.lead.expClose ? (
                      <Chip
                        label={shortDate(entry.lead.expClose)}
                        tone="neutral"
                      />
                    ) : null}
                  </View>
                </Pressable>
              </React.Fragment>
            ))}
          </Card>
        ) : (
          <EmptyState
            title="No opportunities in this band"
            body="Move a deal further along the pipeline and it will appear here."
            actionLabel="Open Pipeline"
            onAction={() => router.push("/(tabs)/pipeline")}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter },
  stats: { flexDirection: "row", gap: space.md, marginTop: space.md },
  stat: { flex: 1 },
  statRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  statPlate: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  statPlateLight: { backgroundColor: color.surfaceWhite },
  statValue: { fontFamily: font.extrabold, fontSize: 19, color: color.ink },
  chipRail: { gap: space.sm, paddingVertical: space.xl },
  listCard: { padding: space.xs },
  divider: {
    height: 1,
    backgroundColor: color.lineSoft,
    marginHorizontal: space.md,
  },
  entry: { padding: space.md, gap: space.sm },
  entryPressed: { opacity: 0.9 },
  entryHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  entryText: { flex: 1, gap: 2 },
  entryValue: { fontFamily: font.extrabold, fontSize: 14, color: color.ink },
  entryChips: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
});
