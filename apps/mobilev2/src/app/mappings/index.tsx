/**
 * 06 / 06A — My Customer Mapping.
 *
 * A mapping is what ties a customer to a product at an agreed price, and an
 * unpriced one is the interesting case: it means quotes for that product fall
 * back to list price. The filter for those is offered first for that reason,
 * and the count sits in the header rather than being something to go looking
 * for.
 */
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Package, Plus } from "lucide-react-native";

import {
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
import { color, radius, space } from "@/design/tokens";
import { money } from "@/lib/format";
import { useAsync, usePagedList } from "@/lib/useAsync";

export default function MappingsScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState("");
  const [unpricedOnly, setUnpricedOnly] = useState(false);
  const [principal, setPrincipal] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const list = usePagedList(
    (cursor) =>
      source.listMappings({
        search: search || undefined,
        unpricedOnly: unpricedOnly || undefined,
        principalId: principal?.id,
        cursor,
        limit: 40,
      }),
    [source, search, unpricedOnly, principal],
  );
  // Counted by the API, over every mapping — not over the rows loaded so far.
  const unpricedCount = useAsync(
    async () =>
      (await source.listMappings({ unpricedOnly: true, limit: 1 })).total,
    [source],
  );

  // Principals come from the rows loaded: a filter chip for a principal this
  // salesperson carries nothing from would always return nothing.
  const principals = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of list.items) byId.set(row.principalId, row.principal);
    if (principal) byId.set(principal.id, principal.name);
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [list.items, principal]);

  const unpriced = unpricedCount.data ?? 0;

  return (
    <Screen
      onRefresh={() => {
        list.reload();
        unpricedCount.reload();
      }}
      refreshing={list.refreshing}
      error={list.error}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.headerText}>
          <Text variant="pageTitle">My Mappings</Text>
          <Text variant="caption" tone="muted">
            {list.loading ? " " : `${list.total} mapped`}
            {unpriced > 0 ? ` · ${unpriced} unpriced` : ""}
          </Text>
        </View>
        <Chip
          label="New"
          tone="mint"
          icon={<Plus size={13} color={color.primaryDark} strokeWidth={2.5} />}
          onPress={() => router.push("/mappings/new")}
        />
      </View>

      <View style={styles.searchRow}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer or product"
        />
      </View>

      <View style={styles.filters}>
        <Chip
          label="Unpriced only"
          active={unpricedOnly}
          onPress={() => setUnpricedOnly((v) => !v)}
        />
        {principals.map((p) => (
          <Chip
            key={p.id}
            label={p.name}
            active={principal?.id === p.id}
            onPress={() => setPrincipal(principal?.id === p.id ? null : p)}
          />
        ))}
      </View>

      {list.loading ? (
        <SkeletonList rows={5} />
      ) : list.error ? null : list.items.length === 0 ? (
        <EmptyState
          title={
            search || unpricedOnly || principal
              ? "Nothing matches"
              : "No mappings yet"
          }
          body={
            search || unpricedOnly || principal
              ? "Clear the search or the filters to see the rest of your mappings."
              : "Map a customer to the products they buy so their agreed prices carry into quotes and orders."
          }
          actionLabel={
            search || unpricedOnly || principal
              ? "Clear filters"
              : "Create a mapping"
          }
          onAction={() => {
            if (search || unpricedOnly || principal) {
              setSearch("");
              setUnpricedOnly(false);
              setPrincipal(null);
            } else {
              router.push("/mappings/new");
            }
          }}
        />
      ) : (
        <View style={styles.list}>
          {list.items.map((mapping) => (
            <Card
              key={mapping.id}
              onPress={() => router.push(`/mapping/${mapping.id}`)}
              accessibilityLabel={`${mapping.customerName}, ${mapping.productName}`}
              style={styles.row}
            >
              <View style={styles.rowInner}>
                <View style={styles.plate}>
                  <Package
                    size={17}
                    color={color.primaryDark}
                    strokeWidth={2}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text variant="cardTitle" numberOfLines={1}>
                    {mapping.customerName}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {mapping.productName} · {mapping.principal}
                  </Text>
                </View>
                <View style={styles.priceCol}>
                  <Text variant="cardTitle">
                    {money(mapping.effectivePrice)}
                  </Text>
                  <Text
                    variant="nano"
                    tone={
                      mapping.agreedPrice != null
                        ? "primaryDark"
                        : mapping.listPrice != null
                          ? "amber"
                          : "redDark"
                    }
                  >
                    {mapping.agreedPrice != null
                      ? "Agreed"
                      : mapping.listPrice != null
                        ? "List price"
                        : "No price"}
                  </Text>
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
            noun="mappings"
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.md,
    paddingBottom: space.sm,
  },
  headerText: { flex: 1, gap: 2 },
  searchRow: { marginTop: space.md },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    paddingVertical: space.lg,
  },
  list: { gap: space.md },
  row: { paddingVertical: space.md },
  rowInner: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowText: { flex: 1, gap: 2 },
  priceCol: { alignItems: "flex-end", gap: 2 },
  plate: {
    width: 36,
    height: 36,
    borderRadius: radius.input,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
});
