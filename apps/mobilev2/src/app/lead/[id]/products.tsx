/**
 * 03F — Products & Assignment.
 *
 * Each product on the opportunity with its principal, the price and quantity
 * quoted, the line value — and, next to it, whether this customer has a
 * mapping for that product, which is what decides whether the quoted price is
 * one they have agreed to.
 *
 * The mapping check is the point of the screen. A line quoted at a price with
 * no mapping behind it is flagged, and the row links straight to the mapping
 * so it can be created or corrected. Where a mapping exists and its agreed
 * price differs from the quoted one, the difference is shown rather than
 * silently preferred either way — which is right depends on the conversation.
 */
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight, CircleAlert, Package, Plus } from "lucide-react-native";

import {
  AppBar,
  Button,
  Card,
  Chip,
  EmptyState,
  KeyValueRow,
  Panel,
  RowDivider,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import type { Mapping } from "@/data/source";
import { color, radius, space } from "@/design/tokens";
import { money, quantity } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

export default function OpportunityProductsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const source = useData();

  const state = useAsync(async () => {
    const lead = id ? await source.getLead(id) : null;
    if (!lead) return { lead: null, customer: null, mappings: [] as Mapping[] };

    const customers = await source.listCustomers({
      search: lead.customerName,
      limit: 10,
    });
    const customer =
      customers.items.find((c) => c.name === lead.customerName) ??
      customers.items[0] ??
      null;

    const mappings = customer
      ? (await source.listMappings({ customerId: customer.id, limit: 100 }))
          .items
      : [];

    return { lead, customer, mappings };
  }, [source, id]);

  const lead = state.data?.lead ?? null;
  const customer = state.data?.customer ?? null;

  const byProduct = useMemo(() => {
    const map = new Map<string, Mapping>();
    for (const row of state.data?.mappings ?? []) map.set(row.productId, row);
    return map;
  }, [state.data]);

  const unmapped = useMemo(
    () =>
      (lead?.products ?? []).filter(
        (p) => p.productId == null || !byProduct.has(p.productId),
      ).length,
    [lead, byProduct],
  );

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="Products & Assignment" />

      <View style={styles.body}>
        {state.loading ? (
          <SkeletonList rows={3} />
        ) : !lead ? (
          <EmptyState
            title="Opportunity not found"
            body="It may have been removed, or it belongs to another salesperson."
            actionLabel="Back to Pipeline"
            onAction={() => router.replace("/(tabs)/pipeline")}
          />
        ) : lead.products.length === 0 ? (
          <EmptyState
            title="No products on this opportunity"
            body="Add the products being quoted so the deal value can be worked out."
            actionLabel="Edit opportunity"
            onAction={() => router.push(`/lead/${lead.id}/edit`)}
          />
        ) : (
          <>
            {unmapped > 0 ? (
              <Card tone="amber">
                <View style={styles.alertRow}>
                  <CircleAlert size={19} color={color.amber} strokeWidth={2} />
                  <Text variant="secondary" style={styles.alertText}>
                    {unmapped === 1
                      ? "One product has no customer mapping, so its price is not an agreed one."
                      : `${unmapped} products have no customer mapping, so their prices are not agreed ones.`}
                  </Text>
                </View>
              </Card>
            ) : null}

            {lead.products.map((product) => {
              const mapping = product.productId
                ? byProduct.get(product.productId)
                : undefined;
              const agreed = mapping?.agreedPrice ?? null;
              const quoted = product.price ?? null;
              const differs =
                agreed != null && quoted != null && agreed !== quoted;

              return (
                <Card key={product.id} style={styles.productCard}>
                  <View style={styles.productHead}>
                    <View style={styles.plate}>
                      <Package
                        size={18}
                        color={color.primaryDark}
                        strokeWidth={2}
                      />
                    </View>
                    <View style={styles.productText}>
                      <Text variant="cardTitle" numberOfLines={2}>
                        {product.productName}
                      </Text>
                      {product.brand ? (
                        <Text variant="caption" tone="muted">
                          {product.brand}
                        </Text>
                      ) : null}
                    </View>
                    <Chip
                      label={
                        mapping
                          ? agreed != null
                            ? "Mapped"
                            : "Mapped, unpriced"
                          : "Not mapped"
                      }
                      tone={
                        mapping ? (agreed != null ? "mint" : "amber") : "red"
                      }
                    />
                  </View>

                  <RowDivider />

                  <View style={styles.facts}>
                    <KeyValueRow
                      label="Quantity"
                      value={
                        product.qty != null
                          ? quantity(product.qty, product.unit)
                          : "Not estimated yet"
                      }
                    />
                    <KeyValueRow
                      label="Quoted price"
                      value={quoted != null ? money(quoted) : "Not set"}
                    />
                    {mapping ? (
                      <KeyValueRow
                        label="Agreed price"
                        value={
                          agreed != null
                            ? money(agreed)
                            : "No agreed price on the mapping"
                        }
                      />
                    ) : null}
                    <KeyValueRow
                      label="Line value"
                      value={product.value != null ? money(product.value) : "—"}
                    />
                  </View>

                  {differs ? (
                    <Panel tone="amber">
                      <Text variant="caption" tone="amber">
                        Quoted at {money(quoted!)} against an agreed{" "}
                        {money(agreed!)}.
                      </Text>
                    </Panel>
                  ) : null}

                  {mapping ? (
                    <Button
                      label="Open mapping"
                      variant="secondary"
                      block
                      icon={
                        <ChevronRight
                          size={15}
                          color={color.primary}
                          strokeWidth={2.5}
                        />
                      }
                      onPress={() => router.push(`/mapping/${mapping.id}`)}
                    />
                  ) : customer ? (
                    <Button
                      label="Create mapping"
                      variant="secondary"
                      block
                      icon={
                        <Plus
                          size={15}
                          color={color.primary}
                          strokeWidth={2.5}
                        />
                      }
                      onPress={() =>
                        router.push(
                          `/mappings/new?customerId=${customer.id}` +
                            (product.productId
                              ? `&productId=${product.productId}`
                              : ""),
                        )
                      }
                    />
                  ) : null}
                </Card>
              );
            })}

            <Panel style={styles.total}>
              <KeyValueRow label="Deal value" value={money(lead.totalValue)} />
            </Panel>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
  alertRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  alertText: { flex: 1 },
  productCard: { gap: space.md },
  productHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
  },
  plate: {
    width: 38,
    height: 38,
    borderRadius: radius.input,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  productText: { flex: 1, gap: 2 },
  facts: {},
  total: { paddingVertical: space.xs },
});
