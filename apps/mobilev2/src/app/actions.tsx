/**
 * 02B — Actions Need Attention.
 *
 * From the Penpot board "02B.1 Actions Overview": the filter chips, the alert
 * banner when anything is overdue, and the rows that lead into each drill-down.
 *
 * Every count is derived from the same source the destination screen reads, so
 * a row saying 5 and the list behind it showing 5 are the same query. The
 * design's "Others" row is omitted: nothing in the product feeds it, and a row
 * permanently reading 0 teaches the user to ignore the screen.
 */
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CalendarClock,
  FileText,
  Target,
  TriangleAlert,
  Wallet,
} from "lucide-react-native";

import {
  AppBar,
  Card,
  Chip,
  IconPlate,
  Screen,
  SkeletonList,
  SyntheticBanner,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { color, font, space } from "@/design/tokens";
import { useAsync } from "@/lib/useAsync";

type Filter = "all" | "overdue" | "payments";

export default function ActionsScreen() {
  const router = useRouter();
  const source = useData();
  const [filter, setFilter] = useState<Filter>("all");

  const state = useAsync(async () => {
    const [overdue, payments, leads, proposals] = await Promise.all([
      source.listFollowUps({ bucket: "overdue", limit: 1 }),
      source.listInvoices({ overdueOnly: true, limit: 1 }),
      source.listLeads({ openOnly: true, limit: 1 }),
      source.listLeads({ stage: "ProposalsAndPriceQuote", limit: 1 }),
    ]);
    return {
      overdue: overdue.total,
      payments: payments.total,
      opportunities: leads.total,
      proposals: proposals.total,
    };
  }, [source]);

  const data = state.data;
  const total = data ? data.overdue + data.payments + data.opportunities + data.proposals : 0;

  const rows = [
    {
      key: "overdue",
      label: "Overdue Follow-up",
      hint: "Customer follow-ups pending",
      count: data?.overdue ?? 0,
      Icon: CalendarClock,
      href: "/followups",
      groups: ["all", "overdue"] as Filter[],
    },
    {
      key: "payments",
      label: "Payment / Outstanding",
      hint: "Payments overdue",
      count: data?.payments ?? 0,
      Icon: Wallet,
      href: "/payments",
      groups: ["all", "payments"] as Filter[],
    },
    {
      key: "opportunities",
      label: "Opportunities",
      hint: "Require your attention",
      count: data?.opportunities ?? 0,
      Icon: Target,
      href: "/hot-opportunities",
      groups: ["all"] as Filter[],
    },
    {
      key: "proposals",
      label: "Proposals / Commitments",
      hint: "Awaiting response",
      count: data?.proposals ?? 0,
      Icon: FileText,
      href: "/(tabs)/pipeline",
      groups: ["all"] as Filter[],
    },
  ].filter((row) => row.groups.includes(filter));

  return (
    <Screen onRefresh={state.reload} refreshing={state.refreshing} bleed>
      <AppBar title="Actions Need Attention" />

      <View style={styles.body}>
        <SyntheticBanner />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRail}
        >
          <Chip label="All" count={total} active={filter === "all"} onPress={() => setFilter("all")} />
          <Chip
            label="Overdue"
            count={data?.overdue ?? 0}
            tone="red"
            active={filter === "overdue"}
            onPress={() => setFilter("overdue")}
          />
          <Chip
            label="Payments"
            count={data?.payments ?? 0}
            tone="mint"
            active={filter === "payments"}
            onPress={() => setFilter("payments")}
          />
        </ScrollView>

        {state.loading || !data ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            {data.overdue > 0 ? (
              <Card tone="red" style={styles.alert}>
                <View style={styles.alertRow}>
                  <TriangleAlert size={19} color={color.redDark} strokeWidth={2} />
                  <View style={styles.alertText}>
                    <Text variant="cardTitle" tone="redDark">
                      {data.overdue} {data.overdue === 1 ? "item is" : "items are"} overdue
                    </Text>
                    <Text variant="secondary" tone="redDark">
                      Take action to keep your pipeline healthy.
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}

            <View style={styles.rows}>
              {rows.map((row) => (
                <Card
                  key={row.key}
                  onPress={() => router.push(row.href as never)}
                  accessibilityLabel={`${row.label}, ${row.count}`}
                  style={styles.rowCard}
                >
                  <View style={styles.row}>
                    <IconPlate size={38}>
                      <row.Icon size={18} color={color.primaryDark} strokeWidth={2} />
                    </IconPlate>
                    <View style={styles.rowText}>
                      <Text variant="cardTitle">{row.label}</Text>
                      <Text variant="secondary" tone="muted">
                        {row.hint}
                      </Text>
                    </View>
                    <Text
                      style={styles.count}
                      tone={row.count > 0 ? "primary" : "muted2"}
                    >
                      {row.count}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>

            <View style={styles.quote}>
              <Text style={styles.quoteLine} align="center">
                “Consistent follow-ups
              </Text>
              <Text style={styles.quoteLine} align="center">
                create bigger opportunities.”
              </Text>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter },
  chipRail: { gap: space.sm, paddingVertical: space.xl },
  alert: { marginBottom: space.xl },
  alertRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  alertText: { flex: 1, gap: 2 },
  rows: { gap: space.md },
  rowCard: { padding: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowText: { flex: 1, gap: 2 },
  count: { fontFamily: font.extrabold, fontSize: 22 },
  quote: { marginTop: space.xxl },
  quoteLine: { fontFamily: font.script, fontSize: 20, lineHeight: 26, color: "#3E6374" },
});
