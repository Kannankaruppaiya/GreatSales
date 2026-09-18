/**
 * 08C / 08K / 08M / 08N — Order detail.
 *
 * The order, its lines and totals, the status timeline built from the order's
 * own `statusHistory`, and the fulfilment durations derived from it.
 *
 * The SLA figures (08M) are computed from the timestamps the order already
 * carries rather than read from a field: acknowledgement is the gap between
 * Created and Acknowledged, transit the gap between leaving the warehouse and
 * reaching the customer, and so on. A stage the order has not reached yet has
 * no duration, and shows as pending rather than as zero.
 *
 * 08N's actions are only the ones a salesperson can carry out. There is no
 * edit or cancel here: the write surface has `createOrder` and nothing else
 * for orders, so offering either would be a button that cannot work.
 */
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, FileText, Package, Plus } from "lucide-react-native";
import type { OrderStatusValue } from "@greatsales/shared";

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
import { color, radius, space } from "@/design/tokens";
import { longDate, money, quantity, timeOfDay } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PAYMENT_TERMS_LABELS,
} from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";

/** The order the statuses are reached in, for the timeline's unreached steps. */
const FLOW: OrderStatusValue[] = [
  "Created",
  "Acknowledged",
  "DeliveryPartnerAssigned",
  "DeliveredFromWarehouse",
  "DeliveredToCustomer",
  "CustomerReceiptConfirmed",
];

/** Whole hours between two instants, or null when either is missing. */
function hoursBetween(from?: string, to?: string): number | null {
  if (!from || !to) return null;
  return Math.max(
    0,
    Math.round((Date.parse(to) - Date.parse(from)) / 3_600_000),
  );
}

function duration(hours: number | null): string {
  if (hours == null) return "Pending";
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const source = useData();

  const state = useAsync(async () => {
    const order = id ? await source.getOrder(id) : null;
    if (!order) return { order: null, invoices: [] };
    const invoices = await source.listInvoices({
      customerId: order.customerId,
      limit: 50,
    });
    return {
      order,
      invoices: invoices.items.filter((i) => i.orderId === order.id),
    };
  }, [source, id]);

  const order = state.data?.order ?? null;

  const reached = useMemo(() => {
    const map = new Map<OrderStatusValue, string>();
    for (const entry of order?.statusHistory ?? [])
      map.set(entry.status, entry.at);
    return map;
  }, [order]);

  const sla = useMemo(() => {
    if (!order) return null;
    const created = reached.get("Created");
    const acknowledged = reached.get("Acknowledged");
    const left = reached.get("DeliveredFromWarehouse");
    const delivered = reached.get("DeliveredToCustomer");
    const confirmed = reached.get("CustomerReceiptConfirmed");

    const late =
      order.expectedDeliveryAt && delivered
        ? Date.parse(delivered) > Date.parse(order.expectedDeliveryAt)
        : order.expectedDeliveryAt
          ? Date.now() > Date.parse(order.expectedDeliveryAt)
          : false;

    return {
      acknowledgement: hoursBetween(created, acknowledged),
      warehouse: hoursBetween(acknowledged, left),
      transit: hoursBetween(left, delivered),
      total: hoursBetween(created, delivered),
      receipt: hoursBetween(delivered, confirmed),
      late,
      overdueBy:
        late && order.expectedDeliveryAt
          ? hoursBetween(
              order.expectedDeliveryAt,
              delivered ?? new Date().toISOString(),
            )
          : null,
    };
  }, [order, reached]);

  return (
    <Screen
      tabBarSpacing
      bleed
      onRefresh={state.reload}
      refreshing={state.refreshing}
    >
      <AppBar title="Order" />

      <View style={styles.body}>
        {state.loading ? (
          <SkeletonList rows={4} />
        ) : !order ? (
          <EmptyState
            title="Order not found"
            body="It may have been removed, or it belongs to another salesperson."
            actionLabel="Back to Orders"
            onAction={() => router.replace("/orders")}
          />
        ) : (
          <>
            <Card>
              <View style={styles.headRow}>
                <View style={styles.headText}>
                  <Text variant="section">{order.soNumber}</Text>
                  <Text variant="body" tone="muted" numberOfLines={1}>
                    {order.customerName}
                  </Text>
                </View>
                <Chip
                  label={ORDER_STATUS_LABELS[order.status]}
                  tone={ORDER_STATUS_TONES[order.status]}
                />
              </View>
              <Text variant="caption" tone="muted">
                Issued {longDate(order.issuedAt)}
              </Text>
            </Card>

            <Card flush>
              {order.lines.map((line, index) => (
                <View key={line.id}>
                  {index > 0 ? <RowDivider /> : null}
                  <View style={styles.line}>
                    <View style={styles.plate}>
                      <Package
                        size={16}
                        color={color.primaryDark}
                        strokeWidth={2}
                      />
                    </View>
                    <View style={styles.headText}>
                      <Text variant="cardTitle" numberOfLines={1}>
                        {line.productName}
                      </Text>
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {quantity(line.qty, line.unit)} × {money(line.price)} ·{" "}
                        {line.principal}
                      </Text>
                    </View>
                    <Text variant="cardTitle">{money(line.value)}</Text>
                  </View>
                </View>
              ))}
            </Card>

            <Panel tone="mint" style={styles.panel}>
              <KeyValueRow label="Subtotal" value={money(order.subtotal)} />
              <KeyValueRow
                label={`Tax (${Math.round(order.taxRate * 100)}%)`}
                value={money(order.tax)}
              />
              <RowDivider />
              <KeyValueRow label="Total" value={money(order.total)} />
            </Panel>

            <Panel style={styles.panel}>
              <KeyValueRow
                label="Payment terms"
                value={
                  order.paymentTerms
                    ? PAYMENT_TERMS_LABELS[order.paymentTerms]
                    : null
                }
                emptyText="Not set"
              />
              <RowDivider />
              <KeyValueRow
                label="Expected delivery"
                value={
                  order.expectedDeliveryAt
                    ? longDate(order.expectedDeliveryAt)
                    : null
                }
                emptyText="Not set"
              />
              <RowDivider />
              <KeyValueRow
                label="Delivery address"
                value={order.deliveryAddress}
                emptyText="Not set"
              />
            </Panel>

            <Text variant="section" style={styles.heading}>
              Status
            </Text>
            <Card flush style={styles.timeline}>
              {FLOW.map((status, index) => {
                const at = reached.get(status);
                const done = at != null;
                return (
                  <View key={status} style={styles.step}>
                    <View style={styles.stepRail}>
                      <View style={[styles.dot, done ? styles.dotDone : null]}>
                        {done ? (
                          <Check
                            size={11}
                            color={color.surfaceWhite}
                            strokeWidth={3}
                          />
                        ) : null}
                      </View>
                      {index < FLOW.length - 1 ? (
                        <View
                          style={[
                            styles.connector,
                            done ? styles.connectorDone : null,
                          ]}
                        />
                      ) : null}
                    </View>
                    <View style={styles.stepText}>
                      <Text variant="cardTitle" tone={done ? "ink" : "muted2"}>
                        {ORDER_STATUS_LABELS[status]}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {at
                          ? `${longDate(at)}, ${timeOfDay(at)}`
                          : "Not reached yet"}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {order.status === "Cancelled" ? (
                <View style={styles.step}>
                  <View style={styles.stepRail}>
                    <View style={[styles.dot, styles.dotCancelled]} />
                  </View>
                  <View style={styles.stepText}>
                    <Text variant="cardTitle" tone="red">
                      Cancelled
                    </Text>
                  </View>
                </View>
              ) : null}
            </Card>

            <Text variant="section" style={styles.heading}>
              Fulfilment
            </Text>
            <Panel style={styles.panel}>
              <KeyValueRow
                label="Acknowledgement"
                value={duration(sla?.acknowledgement ?? null)}
              />
              <RowDivider />
              <KeyValueRow
                label="Warehouse preparation"
                value={duration(sla?.warehouse ?? null)}
              />
              <RowDivider />
              <KeyValueRow
                label="Transit"
                value={duration(sla?.transit ?? null)}
              />
              <RowDivider />
              <KeyValueRow
                label="Total fulfilment"
                value={duration(sla?.total ?? null)}
              />
              <RowDivider />
              <KeyValueRow
                label="Customer receipt"
                value={duration(sla?.receipt ?? null)}
              />
            </Panel>

            {sla?.late ? (
              <Panel tone="red">
                <Text variant="caption" tone="redDark">
                  {sla.overdueBy != null
                    ? `Delivery is ${duration(sla.overdueBy).toLowerCase()} past the expected date.`
                    : "Delivery is past the expected date."}
                </Text>
              </Panel>
            ) : null}

            {(state.data?.invoices.length ?? 0) > 0 ? (
              <>
                <Text variant="section" style={styles.heading}>
                  Invoices
                </Text>
                {state.data?.invoices.map((invoice) => (
                  <Card
                    key={invoice.id}
                    onPress={() => router.push(`/invoice/${invoice.id}`)}
                    style={styles.invoiceRow}
                  >
                    <View style={styles.headRow}>
                      <View style={styles.headText}>
                        <Text variant="cardTitle">{invoice.invoiceNumber}</Text>
                        <Text variant="caption" tone="muted">
                          Due {longDate(invoice.dueAt)}
                        </Text>
                      </View>
                      <Text variant="cardTitle">{money(invoice.pending)}</Text>
                    </View>
                  </Card>
                ))}
              </>
            ) : null}

            <Button
              label="Order Summary"
              variant="secondary"
              block
              icon={
                <FileText size={16} color={color.primary} strokeWidth={2} />
              }
              onPress={() => router.push(`/order/${order.id}/invoice`)}
              style={styles.heading}
            />
            <Button
              label="New Order for this Customer"
              variant="secondary"
              block
              icon={<Plus size={16} color={color.primary} strokeWidth={2.5} />}
              onPress={() =>
                router.push(`/order/new?customerId=${order.customerId}`)
              }
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
  headRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  headText: { flex: 1, gap: 2 },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
  },
  plate: {
    width: 34,
    height: 34,
    borderRadius: radius.input,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: { paddingVertical: space.xs },
  heading: { marginTop: space.sm },
  timeline: { padding: space.lg },
  step: { flexDirection: "row", gap: space.md },
  stepRail: { width: 20, alignItems: "center" },
  dot: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.line,
    backgroundColor: color.surfaceWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: color.primary, borderColor: color.primary },
  dotCancelled: { backgroundColor: color.red, borderColor: color.red },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: color.line,
    marginVertical: 2,
  },
  connectorDone: { backgroundColor: color.primary },
  stepText: { flex: 1, gap: 2, paddingBottom: space.lg },
  invoiceRow: { paddingVertical: space.md },
});
