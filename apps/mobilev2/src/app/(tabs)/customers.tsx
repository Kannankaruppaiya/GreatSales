/**
 * 05 — Customers.
 *
 * From the Penpot boards "05 Customers Map + List" and "05C Customer List".
 * The list is the default view; the map (05D) is a separate route because it
 * needs a map surface this screen should not carry when it is not shown.
 *
 * Outstanding is displayed but never editable here: a salesperson holds
 * payment.read and not payment.write.
 */
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Map, SlidersHorizontal } from "lucide-react-native";

import {
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
import { useData } from "@/data/provider";
import { color, space } from "@/design/tokens";
import { moneyShort } from "@/lib/format";
import {
  CUSTOMER_CATEGORY_LABELS,
  PAY_ZONE_TONES,
  labelFor,
} from "@/lib/labels";
import {
  CustomerFiltersSheet,
  NO_CUSTOMER_FILTERS,
  customerFilterCount,
  type CustomerFilters,
} from "@/components/modals";
import { useAsync, usePagedList } from "@/lib/useAsync";

export default function CustomersScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CustomerFilters>(NO_CUSTOMER_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const active = customerFilterCount(filters);

  const list = usePagedList(
    (cursor) =>
      source.listCustomers({
        search: search || undefined,
        category: filters.category ?? undefined,
        area: filters.area ?? undefined,
        industryId: filters.industry?.id,
        withOutstanding: filters.withOutstanding || undefined,
        cursor,
        limit: 30,
      }),
    [source, search, filters],
  );
  // Industries come from the master list, not from the rows on screen: a
  // filter drawn from loaded rows could only ever offer what was already seen.
  const industries = useAsync(() => source.listIndustries(), [source]);

  // The chips offer what is actually present, so none of them filters to an
  // empty list. They widen as more of the book is loaded, which is honest:
  // this is what the app has seen, not a lookup table it does not have.
  const facets = useMemo(() => {
    const areas = new Set<string>();
    for (const row of list.items) if (row.area) areas.add(row.area);
    return { areas: [...areas].sort().slice(0, 12) };
  }, [list.items]);

  return (
    <Screen
      onRefresh={list.reload}
      refreshing={list.refreshing}
      error={list.error}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text variant="pageTitle">Customers</Text>
        <Text variant="caption" tone="muted">
          {list.loading ? " " : `${list.total} accounts`}
        </Text>
      </View>

      <View style={styles.searchRow}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Name, contact or phone"
          trailing={
            <>
              <Chip
                label="Map"
                tone="neutral"
                onPress={() => router.push("/customers/map")}
                icon={<Map size={13} color={color.muted} strokeWidth={2} />}
              />
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
            </>
          }
        />
      </View>

      {list.loading ? (
        <SkeletonList rows={5} />
      ) : list.items.length > 0 ? (
        <View style={styles.list}>
          {list.items.map((customer) => (
            <Card
              key={customer.id}
              onPress={() => router.push(`/customer/${customer.id}`)}
              accessibilityLabel={customer.name}
            >
              <View style={styles.row}>
                <Avatar name={customer.name} size={40} />
                <View style={styles.rowText}>
                  <Text variant="cardTitle" numberOfLines={1}>
                    {customer.name}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {[customer.area, customer.industryName]
                      .filter(Boolean)
                      .join(" · ") || "No area set"}
                  </Text>
                  <View style={styles.chips}>
                    {customer.category ? (
                      <Chip
                        label={labelFor(
                          CUSTOMER_CATEGORY_LABELS,
                          customer.category,
                        )}
                        tone="neutral"
                      />
                    ) : null}
                    {customer.outstanding > 0 && customer.payZone ? (
                      <Chip
                        label={moneyShort(customer.outstanding)}
                        tone={PAY_ZONE_TONES[customer.payZone]}
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            </Card>
          ))}

          <ListFooter
            shown={list.items.length}
            total={list.total}
            hasMore={list.hasMore}
            loadingMore={list.loadingMore}
            onLoadMore={list.loadMore}
            noun="accounts"
          />
        </View>
      ) : list.error ? null : (
        <EmptyState
          title="No customers match"
          body={
            search
              ? "Try a shorter search, or add this account if it is new to you."
              : "Add the accounts you call on and they will be listed here."
          }
          actionLabel={active > 0 ? "Clear filters" : "Add Customer"}
          onAction={() => {
            if (active > 0) setFilters(NO_CUSTOMER_FILTERS);
            else router.push("/customer/new");
          }}
        />
      )}

      <CustomerFiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={filters}
        onApply={setFilters}
        areas={facets.areas}
        industries={industries.data ?? []}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: space.sm, gap: 2 },
  searchRow: { marginTop: space.md },
  list: { gap: space.md, marginTop: space.xl },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowText: { flex: 1, gap: 3 },
  chips: { flexDirection: "row", gap: space.sm, marginTop: 2 },
});
