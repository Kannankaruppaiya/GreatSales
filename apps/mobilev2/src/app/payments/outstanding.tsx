/**
 * 09A / 09C / 09D / 09E / 09I — Outstanding.
 *
 * Every unpaid invoice, grouped by customer, with the aging bucket each one
 * falls in. The customer grouping is 09E, the red-zone filter is 09C, the age
 * bands are 09I; they are one list with filters because they are one question
 * asked three ways — who owes what, and how late is it.
 *
 * READ ONLY throughout. Nothing here records, edits or chases a payment.
 */
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { Pressable } from "react-native";

import {
  AppBar,
  Card,
  Chip,
  EmptyState,
  Panel,
  Screen,
  SearchBar,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import type { Invoice } from "@/data/source";
import { color, space } from "@/design/tokens";
import { longDate, money, moneyShort } from "@/lib/format";
import { PAY_ZONE_LABELS, PAY_ZONE_TONES } from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";

type Band = "all" | "due" | "1-30" | "31-60" | "61-90" | "90+";

const BANDS: { key: Band; label: string }[] = [
  { key: "all", label: "All" },
  { key: "due", label: "Not due yet" },
  { key: "1-30", label: "1–30 days" },
  { key: "31-60", label: "31–60 days" },
  { key: "61-90", label: "61–90 days" },
  { key: "90+", label: "90+ days" },
];

function inBand(days: number, band: Band): boolean {
  switch (band) {
    case "all":
      return true;
    case "due":
      return days <= 0;
    case "1-30":
      return days >= 1 && days <= 30;
    case "31-60":
      return days >= 31 && days <= 60;
    case "61-90":
      return days >= 61 && days <= 90;
    case "90+":
      return days > 90;
  }
}

export default function OutstandingScreen() {
  const router = useRouter();
  const source = useData();

  const [search, setSearch] = useState("");
  const [band, setBand] = useState<Band>("all");
  const [redZoneOnly, setRedZoneOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  // The whole open ledger: grouping by customer is only true over all of it.
  const state = useAsync(
    () => source.listOpenInvoices(search || undefined),
    [source, search],
  );

  const groups = useMemo(() => {
    const rows = (state.data ?? []).filter(
      (invoice) =>
        invoice.pending > 0 &&
        // Bands are days past due, so "Not due yet" means exactly that.
        inBand(invoice.overdueDays, band) &&
        (!redZoneOnly ||
          invoice.payZone === "RedZone" ||
          invoice.payZone === "Blacklist"),
    );

    const map = new Map<
      string,
      { name: string; payZone: Invoice["payZone"]; rows: Invoice[] }
    >();
    for (const invoice of rows) {
      // An invoice imported with no customer link groups under its name.
      const key = invoice.customerId ?? `name:${invoice.customerName}`;
      const entry = map.get(key) ?? {
        name: invoice.customerName,
        payZone: invoice.payZone,
        rows: [],
      };
      entry.rows.push(invoice);
      // The worst zone on any of a customer's invoices is the one that matters.
      if (invoice.payZone === "Blacklist" || invoice.payZone === "RedZone") {
        entry.payZone = invoice.payZone;
      }
      map.set(key, entry);
    }

    return [...map.entries()]
      .map(([id, entry]) => ({
        id,
        ...entry,
        pending: entry.rows.reduce((sum, r) => sum + r.pending, 0),
        oldest: entry.rows.reduce((max, r) => Math.max(max, r.agingDays), 0),
      }))
      .sort((a, b) => b.pending - a.pending);
  }, [state.data, band, redZoneOnly]);

  const total = groups.reduce((sum, g) => sum + g.pending, 0);
  const filtered = band !== "all" || redZoneOnly || search.length > 0;

  return (
    <Screen
      tabBarSpacing
      bleed
      onRefresh={state.reload}
      refreshing={state.refreshing}
    >
      <AppBar title="Outstanding" />

      <View style={styles.body}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer or invoice"
        />

        <View style={styles.filters}>
          <Chip
            label="Red zone only"
            active={redZoneOnly}
            onPress={() => setRedZoneOnly((v) => !v)}
          />
          {BANDS.map((entry) => (
            <Chip
              key={entry.key}
              label={entry.label}
              active={band === entry.key}
              onPress={() => setBand(entry.key)}
            />
          ))}
        </View>

        {state.loading ? (
          <SkeletonList rows={5} />
        ) : groups.length === 0 ? (
          <EmptyState
            title={filtered ? "Nothing matches" : "Nothing outstanding"}
            body={
              filtered
                ? "Widen the age band or clear the filters to see the rest."
                : "Every invoice on your accounts has been settled."
            }
            actionLabel={filtered ? "Clear filters" : undefined}
            onAction={
              filtered
                ? () => {
                    setSearch("");
                    setBand("all");
                    setRedZoneOnly(false);
                  }
                : undefined
            }
          />
        ) : (
          <>
            <Panel tone={total > 0 ? "amber" : "mint"} style={styles.total}>
              <Text variant="hero">{money(total)}</Text>
              <Text variant="caption" tone="muted">
                across {groups.length}{" "}
                {groups.length === 1 ? "customer" : "customers"}
              </Text>
            </Panel>

            {groups.map((group) => {
              const expanded = open === group.id;
              return (
                <Card key={group.id} style={styles.group} flush>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={`${group.name}, ${moneyShort(group.pending)} outstanding`}
                    onPress={() => setOpen(expanded ? null : group.id)}
                    style={styles.groupHead}
                  >
                    <View style={styles.groupText}>
                      <Text variant="cardTitle" numberOfLines={1}>
                        {group.name}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {group.rows.length}{" "}
                        {group.rows.length === 1 ? "invoice" : "invoices"}
                        {group.oldest > 0
                          ? ` · oldest ${group.oldest} days`
                          : ""}
                      </Text>
                    </View>
                    <View style={styles.groupRight}>
                      <Text variant="cardTitle">
                        {moneyShort(group.pending)}
                      </Text>
                      {group.payZone ? (
                        <Chip
                          label={PAY_ZONE_LABELS[group.payZone]}
                          tone={PAY_ZONE_TONES[group.payZone]}
                        />
                      ) : null}
                    </View>
                    {expanded ? (
                      <ChevronDown
                        size={16}
                        color={color.muted2}
                        strokeWidth={2}
                      />
                    ) : (
                      <ChevronRight
                        size={16}
                        color={color.muted2}
                        strokeWidth={2}
                      />
                    )}
                  </Pressable>

                  {expanded
                    ? group.rows.map((invoice) => (
                        <Pressable
                          key={invoice.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Invoice ${invoice.invoiceNumber}`}
                          onPress={() => router.push(`/invoice/${invoice.id}`)}
                          style={styles.invoiceRow}
                        >
                          <View style={styles.groupText}>
                            <Text variant="secondary">
                              {invoice.invoiceNumber}
                            </Text>
                            <Text variant="nano" tone="muted">
                              {invoice.dueAt
                                ? `Due ${longDate(invoice.dueAt)}`
                                : `${invoice.agingDays} days old`}
                            </Text>
                          </View>
                          <View style={styles.groupRight}>
                            <Text variant="secondary">
                              {money(invoice.pending)}
                            </Text>
                            <Text
                              variant="nano"
                              tone={invoice.overdueDays > 0 ? "red" : "muted2"}
                            >
                              {invoice.overdueDays > 0
                                ? `${invoice.overdueDays} days overdue`
                                : "Not due yet"}
                            </Text>
                          </View>
                        </Pressable>
                      ))
                    : null}
                </Card>
              );
            })}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.md },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    paddingBottom: space.sm,
  },
  total: { alignItems: "center", gap: 2, paddingVertical: space.lg },
  group: {},
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
  },
  groupText: { flex: 1, gap: 2 },
  groupRight: { alignItems: "flex-end", gap: space.xs },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: color.lineSoft,
  },
});
