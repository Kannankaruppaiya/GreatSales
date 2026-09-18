/**
 * 10 / 10A / 10B / 10C — Search.
 *
 * The spec says to check whether a global-search API exists before building
 * this, and not to fake one. It does not: there is no search controller in
 * `apps/api/src`, only a `search` parameter on each list endpoint.
 * `BACKEND_CAPABILITIES.globalSearch` records that.
 *
 * So this is a fan-out: the same term is sent to each list endpoint and the
 * answers are grouped. It is honest about what that means — results are
 * ranked within a module and not across them, and the screen says so rather
 * than presenting a merged ranking it did not compute.
 *
 * Recent searches are kept for this session only. Storing them would mean
 * writing customer names to the device, and nothing in the product asks for
 * that.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Building2,
  CalendarCheck,
  ChartColumn,
  ChevronRight,
  IndianRupee,
  ShoppingCart,
  Target,
} from "lucide-react-native";

import {
  Card,
  Chip,
  EmptyState,
  Panel,
  Screen,
  SearchBar,
  SkeletonList,
  Text,
} from "@/components/ui";
import { BACKEND_CAPABILITIES } from "@/data/config";
import { useData } from "@/data/provider";
import { color, radius, space } from "@/design/tokens";
import { longDate, money, moneyShort } from "@/lib/format";
import { DEAL_STAGE_LABELS, ORDER_STATUS_LABELS } from "@/lib/labels";

type Category =
  | "customers"
  | "leads"
  | "orders"
  | "followups"
  | "projections"
  | "payments";

const CATEGORIES: { key: Category; label: string; Icon: typeof Building2 }[] = [
  { key: "customers", label: "Customers", Icon: Building2 },
  { key: "leads", label: "Opportunities", Icon: Target },
  { key: "orders", label: "Orders", Icon: ShoppingCart },
  { key: "followups", label: "Follow-ups", Icon: CalendarCheck },
  { key: "projections", label: "Projections", Icon: ChartColumn },
  { key: "payments", label: "Payments", Icon: IndianRupee },
];

interface Hit {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
}

type Results = Record<Category, Hit[]>;

const EMPTY_RESULTS: Results = {
  customers: [],
  leads: [],
  orders: [],
  followups: [],
  projections: [],
  payments: [],
};

export default function SearchScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [results, setResults] = useState<Results>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  const run = useCallback(
    async (search: string): Promise<Results> => {
      // Each module is asked separately, because that is all the API offers.
      const [customers, leads, orders, followUps, projections, invoices] =
        await Promise.all([
          source.listCustomers({ search, limit: 6 }),
          source.listLeads({ search, limit: 6 }),
          source.listOrders({ search, limit: 6 }),
          source.listFollowUps({ search, limit: 6 }),
          source.listProjections({ search, limit: 6 }),
          source.listInvoices({ search, limit: 6 }),
        ]);

      return {
        customers: customers.items.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle:
            [row.industryName, row.area].filter(Boolean).join(" · ") ||
            "No area recorded",
          meta:
            row.outstanding > 0
              ? `${moneyShort(row.outstanding)} due`
              : undefined,
          href: `/customer/${row.id}`,
        })),
        leads: leads.items.map((row) => ({
          id: row.id,
          title: row.products[0]?.productName ?? row.customerName,
          subtitle: `${row.customerName} · ${DEAL_STAGE_LABELS[row.stage]}`,
          meta: moneyShort(row.totalValue),
          href: `/lead/${row.id}`,
        })),
        orders: orders.items.map((row) => ({
          id: row.id,
          title: row.soNumber,
          subtitle: `${row.customerName} · ${ORDER_STATUS_LABELS[row.status]}`,
          meta: moneyShort(row.total),
          href: `/order/${row.id}`,
        })),
        followups: followUps.items.map((row) => ({
          id: row.id,
          title: row.purpose,
          subtitle: `${row.customerName} · ${longDate(row.dueAt)}`,
          href: `/followup/${row.id}`,
        })),
        projections: projections.items.map((row) => ({
          id: row.id,
          title: row.productName,
          subtitle: `${row.customerName} · ${row.period}`,
          meta: moneyShort(row.projectedValue),
          href: `/projection/${row.id}`,
        })),
        payments: invoices.items.map((row) => ({
          id: row.id,
          title: row.invoiceNumber,
          subtitle: `${row.customerName} · due ${longDate(row.dueAt)}`,
          meta: money(row.pending),
          href: `/invoice/${row.id}`,
        })),
      };
    },
    [source],
  );

  useEffect(() => {
    const search = term.trim();
    if (search.length < 2) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    let live = true;
    setLoading(true);
    // Six requests per keystroke would be six too many, so the term settles
    // first. A late answer for an older term is discarded either way.
    const timer = setTimeout(() => {
      run(search)
        .then((next) => {
          if (!live) return;
          setResults(next);
          setRecent((current) =>
            [search, ...current.filter((t) => t !== search)].slice(0, 6),
          );
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 300);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [term, run]);

  const total = useMemo(
    () => Object.values(results).reduce((sum, rows) => sum + rows.length, 0),
    [results],
  );

  const visible = category
    ? CATEGORIES.filter((c) => c.key === category)
    : CATEGORIES;
  const searching = term.trim().length >= 2;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text variant="pageTitle">Search</Text>
      </View>

      <SearchBar
        value={term}
        onChangeText={setTerm}
        placeholder="Customers, opportunities, orders, invoices"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        <Chip
          label="All"
          active={category == null}
          onPress={() => setCategory(null)}
        />
        {CATEGORIES.map((entry) => (
          <Chip
            key={entry.key}
            label={entry.label}
            count={searching ? results[entry.key].length : undefined}
            active={category === entry.key}
            onPress={() =>
              setCategory(category === entry.key ? null : entry.key)
            }
          />
        ))}
      </ScrollView>

      {!searching ? (
        <>
          {recent.length > 0 ? (
            <View style={styles.section}>
              <Text variant="section">Recent</Text>
              <View style={styles.recentRow}>
                {recent.map((entry) => (
                  <Chip
                    key={entry}
                    label={entry}
                    onPress={() => setTerm(entry)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <EmptyState
            title="Search your accounts"
            body="Type at least two characters to look across customers, opportunities, orders, follow-ups, projections and invoices."
          />

          {!BACKEND_CAPABILITIES.globalSearch ? (
            <Panel style={styles.note}>
              <Text variant="caption" tone="muted">
                Each module is searched separately, so results are ranked within
                a group rather than against each other.
              </Text>
            </Panel>
          ) : null}
        </>
      ) : loading && total === 0 ? (
        <SkeletonList rows={5} />
      ) : total === 0 ? (
        <EmptyState
          title="Nothing found"
          body={`No customer, opportunity, order, follow-up, projection or invoice matches “${term.trim()}”.`}
        />
      ) : (
        <View style={styles.results}>
          {visible.map((entry) => {
            const rows = results[entry.key];
            if (rows.length === 0) return null;
            return (
              <View key={entry.key} style={styles.section}>
                <View style={styles.groupHead}>
                  <entry.Icon size={16} color={color.muted} strokeWidth={2} />
                  <Text variant="section">{entry.label}</Text>
                  <Text variant="caption" tone="muted2">
                    {rows.length}
                  </Text>
                </View>

                {rows.map((hit) => (
                  <Card
                    key={hit.id}
                    onPress={() => router.push(hit.href as never)}
                    accessibilityLabel={hit.title}
                    style={styles.hit}
                  >
                    <View style={styles.hitRow}>
                      <View style={styles.hitText}>
                        <Text variant="cardTitle" numberOfLines={1}>
                          {hit.title}
                        </Text>
                        <Text variant="caption" tone="muted" numberOfLines={1}>
                          {hit.subtitle}
                        </Text>
                      </View>
                      {hit.meta ? (
                        <Text variant="secondary" tone="muted">
                          {hit.meta}
                        </Text>
                      ) : null}
                      <ChevronRight
                        size={15}
                        color={color.muted2}
                        strokeWidth={2}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: space.md },
  rail: { gap: space.sm, paddingVertical: space.lg },
  section: { gap: space.md, marginBottom: space.xl },
  recentRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  results: {},
  groupHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  hit: { paddingVertical: space.md, borderRadius: radius.card },
  hitRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  hitText: { flex: 1, gap: 2 },
  note: { marginTop: space.lg },
});
