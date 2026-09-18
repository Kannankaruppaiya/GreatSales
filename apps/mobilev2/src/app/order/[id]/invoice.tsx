/**
 * 08L — Order summary / print view.
 *
 * The order laid out as a document: header, parties, an itemised table,
 * totals, and the terms underneath. It is deliberately plain — no cards, no
 * tints — because this is the view a salesperson holds up on a phone or
 * screenshots into a chat.
 *
 * It is titled "Order Summary" and not "Invoice". Invoices are issued by
 * finance and this app has no endpoint that renders one; calling an order
 * summary an invoice would be the app claiming a document it did not produce.
 * The real invoices raised against this order are linked from the order screen.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  AppBar,
  EmptyState,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { color, space } from "@/design/tokens";
import { longDate, money, quantity } from "@/lib/format";
import { ORDER_STATUS_LABELS, PAYMENT_TERMS_LABELS } from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";

export default function OrderSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const source = useData();

  const state = useAsync(async () => {
    const order = id ? await source.getOrder(id) : null;
    if (!order) return { order: null, customer: null };
    const customer = await source.getCustomer(order.customerId);
    return { order, customer };
  }, [source, id]);

  const order = state.data?.order ?? null;
  const customer = state.data?.customer ?? null;

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="Order Summary" />

      <View style={styles.body}>
        {state.loading ? (
          <SkeletonList rows={4} />
        ) : !order ? (
          <EmptyState
            title="Order not found"
            body="It may have been removed since this screen was opened."
            actionLabel="Back to Orders"
            onAction={() => router.replace("/orders")}
          />
        ) : (
          <View style={styles.sheet}>
            <View style={styles.masthead}>
              <Text variant="hero">GreatSales</Text>
              <Text variant="caption" tone="muted">
                Sales order
              </Text>
            </View>

            <View style={styles.rule} />

            <View style={styles.meta}>
              <View style={styles.metaCol}>
                <Text variant="nano" tone="muted">
                  ORDER
                </Text>
                <Text variant="cardTitle">{order.soNumber}</Text>
              </View>
              <View style={styles.metaCol}>
                <Text variant="nano" tone="muted">
                  ISSUED
                </Text>
                <Text variant="cardTitle">{longDate(order.issuedAt)}</Text>
              </View>
              <View style={styles.metaCol}>
                <Text variant="nano" tone="muted">
                  STATUS
                </Text>
                <Text variant="cardTitle">{ORDER_STATUS_LABELS[order.status]}</Text>
              </View>
            </View>

            <View style={styles.parties}>
              <View style={styles.party}>
                <Text variant="nano" tone="muted">
                  BILL TO
                </Text>
                <Text variant="cardTitle">{order.customerName}</Text>
                {customer?.area ? (
                  <Text variant="caption" tone="muted">
                    {customer.area}
                  </Text>
                ) : null}
                {customer?.primaryContactName ? (
                  <Text variant="caption" tone="muted">
                    {customer.primaryContactName}
                    {customer.primaryContactPhone ? ` · ${customer.primaryContactPhone}` : ""}
                  </Text>
                ) : null}
              </View>
              <View style={styles.party}>
                <Text variant="nano" tone="muted">
                  DELIVER TO
                </Text>
                <Text variant="caption">
                  {order.deliveryAddress ?? customer?.area ?? "Not specified"}
                </Text>
                {order.expectedDeliveryAt ? (
                  <Text variant="caption" tone="muted">
                    Expected {longDate(order.expectedDeliveryAt)}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.rule} />

            <View style={styles.tableHead}>
              <Text variant="nano" tone="muted" style={styles.colItem}>
                ITEM
              </Text>
              <Text variant="nano" tone="muted" style={styles.colQty}>
                QTY
              </Text>
              <Text variant="nano" tone="muted" align="right" style={styles.colAmount}>
                AMOUNT
              </Text>
            </View>

            {order.lines.map((line) => (
              <View key={line.id} style={styles.tableRow}>
                <View style={styles.colItem}>
                  <Text variant="secondary" numberOfLines={2}>
                    {line.productName}
                  </Text>
                  <Text variant="nano" tone="muted">
                    {line.principal} · {money(line.price)} per {line.unit}
                  </Text>
                </View>
                <Text variant="secondary" style={styles.colQty}>
                  {quantity(line.qty, line.unit)}
                </Text>
                <Text variant="secondary" align="right" style={styles.colAmount}>
                  {money(line.value)}
                </Text>
              </View>
            ))}

            <View style={styles.rule} />

            <View style={styles.totals}>
              <TotalRow label="Subtotal" value={money(order.subtotal)} />
              <TotalRow
                label={`Tax (${Math.round(order.taxRate * 100)}%)`}
                value={money(order.tax)}
              />
              <View style={styles.rule} />
              <TotalRow label="Total" value={money(order.total)} strong />
            </View>

            <View style={styles.terms}>
              <Text variant="nano" tone="muted">
                PAYMENT TERMS
              </Text>
              <Text variant="secondary">
                {order.paymentTerms ? PAYMENT_TERMS_LABELS[order.paymentTerms] : "Not specified"}
              </Text>
            </View>

            <Text variant="nano" tone="muted2" align="center" style={styles.foot}>
              This is an order summary, not a tax invoice.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <Text variant={strong ? "cardTitle" : "secondary"} tone={strong ? "ink" : "muted"}>
        {label}
      </Text>
      <Text variant={strong ? "cardTitle" : "secondary"}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter },
  sheet: {
    backgroundColor: color.surfaceWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.section,
    gap: space.lg,
  },
  masthead: { gap: 2 },
  rule: { height: 1, backgroundColor: color.line },
  meta: { flexDirection: "row", gap: space.md },
  metaCol: { flex: 1, gap: 2 },
  parties: { gap: space.lg },
  party: { gap: 2 },
  tableHead: { flexDirection: "row", gap: space.sm },
  tableRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  colItem: { flex: 1, gap: 2 },
  colQty: { width: 66 },
  colAmount: { width: 86 },
  totals: { gap: space.xs },
  totalRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  terms: { gap: 2 },
  foot: { marginTop: space.sm },
});
