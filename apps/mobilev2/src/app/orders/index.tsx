/**
 * 08 / 08A / 08B — Sales Orders.
 *
 * The list, its search and its status filter. Status is the filter that
 * matters here: an order that has left the warehouse and one that has not
 * been acknowledged need different things from the salesperson.
 *
 * The rail shows only the statuses present in the data, for the same reason
 * the pipeline rail does — a chip that filters to nothing is a dead control.
 */
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, ShoppingCart } from "lucide-react-native";
import type { OrderStatusValue } from "@greatsales/shared";

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
import { longDate, moneyShort } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";

export default function OrdersScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatusValue | null>(null);

  const state = useAsync(
    () =>
      source.listOrders({
        search: search || undefined,
        status: status ?? undefined,
        limit: 50,
      }),
    [source, search, status],
  );

  // Counted over the loaded page, and labelled as such — there is no
  // per-status aggregate endpoint to ask for the real totals.
  const statuses = useMemo(() => {
    const counts = new Map<OrderStatusValue, number>();
    for (const order of state.data?.items ?? []) {
      counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [state.data]);

  const value = useMemo(
    () => (state.data?.items ?? []).reduce((sum, o) => sum + o.total, 0),
    [state.data],
  );

  return (
    <Screen onRefresh={state.reload} refreshing={state.refreshing}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.headerText}>
          <Text variant="pageTitle">Sales Orders</Text>
          <Text variant="caption" tone="muted">
            {state.data
              ? `${state.data.total} orders · ${moneyShort(value)}`
              : " "}
          </Text>
        </View>
        <Chip
          label="New"
          tone="mint"
          icon={<Plus size={13} color={color.primaryDark} strokeWidth={2.5} />}
          onPress={() => router.push("/order/new")}
        />
      </View>

      <SyntheticBanner />

      <View style={styles.searchRow}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search order number or customer"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        <Chip
          label="All"
          active={status == null}
          onPress={() => setStatus(null)}
        />
        {statuses.map(([value_, count]) => (
          <Chip
            key={value_}
            label={ORDER_STATUS_LABELS[value_]}
            count={count}
            tone={ORDER_STATUS_TONES[value_]}
            active={status === value_}
            onPress={() => setStatus(status === value_ ? null : value_)}
          />
        ))}
      </ScrollView>

      {state.loading ? (
        <SkeletonList rows={5} />
      ) : (state.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title={search || status ? "Nothing matches" : "No orders yet"}
          body={
            search || status
              ? "Clear the search or the status filter to see the rest."
              : "Convert an opportunity into an order, or start one from here."
          }
          actionLabel={search || status ? "Clear filters" : "New order"}
          onAction={() => {
            if (search || status) {
              setSearch("");
              setStatus(null);
            } else {
              router.push("/order/new");
            }
          }}
        />
      ) : (
        <View style={styles.list}>
          {state.data?.items.map((order) => (
            <Card
              key={order.id}
              onPress={() => router.push(`/order/${order.id}`)}
              accessibilityLabel={`${order.soNumber}, ${order.customerName}`}
              style={styles.row}
            >
              <View style={styles.rowInner}>
                <View style={styles.plate}>
                  <ShoppingCart
                    size={17}
                    color={color.primaryDark}
                    strokeWidth={2}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text variant="cardTitle" numberOfLines={1}>
                    {order.customerName}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {order.soNumber} · {longDate(order.issuedAt)}
                  </Text>
                  <Text variant="nano" tone="muted2" numberOfLines={1}>
                    {order.lines.length}{" "}
                    {order.lines.length === 1 ? "product" : "products"}
                  </Text>
                </View>
                <View style={styles.priceCol}>
                  <Text variant="cardTitle">{moneyShort(order.total)}</Text>
                  <Chip
                    label={ORDER_STATUS_LABELS[order.status]}
                    tone={ORDER_STATUS_TONES[order.status]}
                  />
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
  rail: { gap: space.sm, paddingVertical: space.lg },
  list: { gap: space.md },
  row: { paddingVertical: space.md },
  rowInner: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowText: { flex: 1, gap: 2 },
  priceCol: { alignItems: "flex-end", gap: space.xs },
  plate: {
    width: 36,
    height: 36,
    borderRadius: radius.input,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
});
