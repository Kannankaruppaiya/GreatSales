/**
 * 09 / 09B — Payments overview and aging.
 *
 * READ ONLY. A salesperson holds `payment.read` and not `payment.write`, so
 * this flow helps them understand collections and never records one. There is
 * no record, edit, delete, import or send-reminder control anywhere in it, and
 * the write interface these screens are handed has no payment method to call —
 * the restriction is in the types, not only in the layout.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, Info } from "lucide-react-native";

import {
  Card,
  EmptyState,
  Panel,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { color, radius, space } from "@/design/tokens";
import { money, moneyShort } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

export default function PaymentsScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  const state = useAsync(() => source.getPaymentsSummary(), [source]);
  const summary = state.data ?? null;

  const widest = Math.max(1, ...(summary?.aging ?? []).map((b) => b.amount));

  return (
    <Screen
      onRefresh={state.reload}
      refreshing={state.refreshing}
      error={state.error}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text variant="pageTitle">Payments</Text>
        <Text variant="caption" tone="muted">
          What your customers owe
        </Text>
      </View>

      {state.loading || !summary ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          <View style={styles.metrics}>
            <Metric
              label="Total outstanding"
              value={moneyShort(summary.totalPending)}
              big
            />
            <Metric label="Open invoices" value={String(summary.openCount)} />
            <Metric
              label="Overdue"
              value={moneyShort(summary.overdue)}
              tone="red"
            />
            <Metric
              label="Over 90 days"
              value={moneyShort(summary.over90Days)}
              tone="red"
            />
          </View>

          <Card
            onPress={() => router.push("/payments/outstanding")}
            accessibilityLabel="Outstanding invoices"
            style={styles.linkCard}
          >
            <View style={styles.linkRow}>
              <View style={styles.linkText}>
                <Text variant="cardTitle">Outstanding invoices</Text>
                <Text variant="caption" tone="muted">
                  Every unpaid invoice, by customer and by age
                </Text>
              </View>
              <ChevronRight size={17} color={color.muted2} strokeWidth={2} />
            </View>
          </Card>

          <Text variant="section" style={styles.heading}>
            Aging
          </Text>

          {summary.openCount === 0 ? (
            <EmptyState
              title="Nothing outstanding"
              body="Every invoice on your accounts has been settled."
            />
          ) : (
            <Card style={styles.agingCard}>
              {summary.aging.map((bucket) => (
                <View key={bucket.bucket} style={styles.bucket}>
                  <View style={styles.bucketHead}>
                    <Text variant="secondary" style={styles.bucketLabel}>
                      {bucket.bucket}
                    </Text>
                    <Text variant="cardTitle">{money(bucket.amount)}</Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        {
                          // Bars are relative to the largest bucket, so the
                          // shape of the aging is readable at any scale.
                          width: `${Math.round((bucket.amount / widest) * 100)}%`,
                          backgroundColor: barColor(bucket.bucket),
                        },
                      ]}
                    />
                  </View>
                  <Text variant="nano" tone="muted2">
                    {bucket.count} {bucket.count === 1 ? "invoice" : "invoices"}
                  </Text>
                </View>
              ))}
            </Card>
          )}

          <Panel style={styles.note}>
            <View style={styles.noteRow}>
              <Info size={16} color={color.muted} strokeWidth={2} />
              <Text variant="caption" tone="muted" style={styles.noteText}>
                These figures are read-only. Recording a payment, editing one or
                sending a reminder happens in the web console, not here.
              </Text>
            </View>
          </Panel>
        </>
      )}
    </Screen>
  );
}

/** Later buckets read hotter, matching the chips board's aging semantics. */
/** Older money is redder. Buckets are invoice age, from GET /payments/summary. */
function barColor(bucket: string): string {
  if (bucket.startsWith("90+")) return color.red;
  if (bucket.startsWith("61-")) return color.redDark;
  if (bucket.startsWith("31-")) return color.amber;
  return color.primary;
}

function Metric({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: "red";
  big?: boolean;
}) {
  return (
    <Panel
      tone={tone === "red" ? "red" : "mint"}
      style={[styles.metric, big ? styles.metricBig : null]}
    >
      <Text
        variant={big ? "hero" : "section"}
        tone={tone === "red" ? "redDark" : "ink"}
      >
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: space.sm, gap: 2 },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
    marginTop: space.xl,
  },
  metric: { width: "47.5%", gap: 2, minHeight: 74, justifyContent: "center" },
  metricBig: { width: "100%" },
  linkCard: { marginTop: space.xl, paddingVertical: space.lg },
  linkRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  linkText: { flex: 1, gap: 2 },
  heading: { marginTop: space.xxl, marginBottom: space.md },
  agingCard: { gap: space.lg },
  bucket: { gap: space.xs },
  bucketHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  bucketLabel: { flex: 1 },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: color.lineSoft,
    overflow: "hidden",
  },
  fill: { height: 8, borderRadius: radius.pill },
  note: { marginTop: space.xxl },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  noteText: { flex: 1 },
});
