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
  Screen,
  SearchBar,
  SkeletonList,
  SyntheticBanner,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { color, radius, space } from "@/design/tokens";
import { money } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

export default function MappingsScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState("");
  const [unpricedOnly, setUnpricedOnly] = useState(false);
  const [principal, setPrincipal] = useState<string | null>(null);

  const state = useAsync(
    () =>
      source.listMappings({
        search: search || undefined,
        unpricedOnly: unpricedOnly || undefined,
        principal: principal ?? undefined,
        limit: 50,
      }),
    [source, search, unpricedOnly, principal],
  );

  // Principals come from the rows on screen: a filter chip for a principal
  // this salesperson carries nothing from would always return nothing.
  const principals = useMemo(() => {
    const names = new Set<string>();
    for (const row of state.data?.items ?? []) names.add(row.principal);
    return [...names].sort();
  }, [state.data]);

  const unpriced = useMemo(
    () => (state.data?.items ?? []).filter((m) => m.agreedPrice == null).length,
    [state.data],
  );

  return (
    <Screen onRefresh={state.reload} refreshing={state.refreshing}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.headerText}>
          <Text variant="pageTitle">My Mappings</Text>
          <Text variant="caption" tone="muted">
            {state.data ? `${state.data.total} mapped` : " "}
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

      <SyntheticBanner />

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
        {principals.map((name) => (
          <Chip
            key={name}
            label={name}
            active={principal === name}
            onPress={() => setPrincipal(principal === name ? null : name)}
          />
        ))}
      </View>

      {state.loading ? (
        <SkeletonList rows={5} />
      ) : (state.data?.items.length ?? 0) === 0 ? (
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
          {state.data?.items.map((mapping) => (
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
                    {money(mapping.agreedPrice ?? mapping.listPrice)}
                  </Text>
                  <Text
                    variant="nano"
                    tone={mapping.agreedPrice != null ? "primaryDark" : "amber"}
                  >
                    {mapping.agreedPrice != null ? "Agreed" : "List price"}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
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
