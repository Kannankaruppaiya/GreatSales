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
 * 08N's actions are the ones the API lets a salesperson take on their own
 * order: move it one rung along the fulfilment ladder, cancel it with a
 * reason, or — while it is still only Created — delete it. The ladder rules
 * (one rung at a time, nothing out of Cancelled) are the server's; this
 * screen offers the next rung and nothing else, so it cannot ask for a move
 * the server would refuse.
 */
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChartColumn,
  Check,
  ChevronRight,
  FileText,
  Package,
  Plus,
} from "lucide-react-native";
import type { OrderStatusValue } from "@greatsales/shared";

import {
  AppBar,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
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
  labelFor,
} from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";
import { describeError } from "@/data/http";
import { confirmAction } from "@/lib/confirm";
import { leave } from "@/lib/nav";

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
    return { order };
  }, [source, id]);

  const order = state.data?.order ?? null;

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  /** The rung after the current one, or null at the top of the ladder. */
  const next: OrderStatusValue | null = (() => {
    if (!order || order.status === "Cancelled") return null;
    const i = FLOW.indexOf(order.status);
    return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1]! : null;
  })();

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await work();
      state.reload();
    } catch (e) {
      setActionError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function advance(status: OrderStatusValue) {
    if (!order) return;
    const ok = await confirmAction({
      title: `Mark as ${ORDER_STATUS_LABELS[status]}?`,
      message: `${order.soNumber} moves to ${ORDER_STATUS_LABELS[status]}. The time is recorded on its timeline.`,
      confirmLabel: "Update",
    });
    if (ok) await run(() => source.setOrderStatus(order.id, status));
  }

  async function cancel() {
    if (!order) return;
    await run(async () => {
      await source.cancelOrder(order.id, reason.trim());
      setCancelOpen(false);
      setReason("");
    });
  }

  async function remove() {
    if (!order) return;
    const ok = await confirmAction({
      title: "Delete this order?",
      message: `${order.soNumber} has not been acknowledged yet. Deleting removes it from your orders.`,
      confirmLabel: "Delete",
      cancelLabel: "Keep it",
      destructive: true,
    });
    if (!ok) return;
    try {
      await source.deleteOrder(order.id);
      leave(router, "/orders");
    } catch (e) {
      setActionError(describeError(e));
    }
  }

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
                        {quantity(line.qty, line.unit)} × {money(line.price)}
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
                label={
                  order.taxRate != null ? `Tax (${order.taxRate}%)` : "Tax"
                }
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
                    ? labelFor(
                        PAYMENT_TERMS_LABELS as Record<string, string>,
                        order.paymentTerms,
                      )
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
              {/*
               * Shown because it is stored: the notes typed on the order screen
               * used to be collected, reviewed and then dropped on save, which
               * is worse than not asking for them.
               */}
              {order.notes ? (
                <>
                  <RowDivider />
                  <KeyValueRow label="Notes" value={order.notes} />
                </>
              ) : null}
            </Panel>

            {order.projectionId ? (
              <Card
                onPress={() => router.push(`/projection/${order.projectionId}`)}
                accessibilityLabel="Open the projection this order came from"
              >
                <View style={styles.originRow}>
                  <ChartColumn
                    size={17}
                    color={color.primaryDark}
                    strokeWidth={2}
                  />
                  <Text
                    variant="caption"
                    tone="muted"
                    style={styles.originText}
                  >
                    Raised from a recurring projection
                  </Text>
                  <ChevronRight
                    size={16}
                    color={color.muted2}
                    strokeWidth={2}
                  />
                </View>
              </Card>
            ) : null}

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

            {/*
              The ledger does not link an invoice to the order it billed —
              invoices arrive from accounting keyed to the customer — so the
              honest link is to the customer's receivables, not a guessed list.
            */}
            <Card
              onPress={() => router.push(`/customer/${order.customerId}`)}
              accessibilityLabel={`Open ${order.customerName}'s account and receivables`}
              style={styles.invoiceRow}
            >
              <View style={styles.headRow}>
                <View style={styles.headText}>
                  <Text variant="cardTitle">{order.customerName}</Text>
                  <Text variant="caption" tone="muted">
                    Account, outstanding and invoices
                  </Text>
                </View>
                <ChevronRight size={16} color={color.muted2} strokeWidth={2} />
              </View>
            </Card>

            {order.status !== "Cancelled" ? (
              <View style={styles.actions}>
                <Text variant="section">Update Order</Text>
                {next ? (
                  <Button
                    label={`Mark as ${ORDER_STATUS_LABELS[next]}`}
                    block
                    loading={busy}
                    onPress={() => void advance(next)}
                  />
                ) : null}
                {cancelOpen ? (
                  <Panel style={styles.cancelPanel}>
                    <Input
                      label="Why is it being cancelled?"
                      value={reason}
                      onChangeText={setReason}
                      placeholder="Customer postponed, wrong grade ordered…"
                      multiline
                    />
                    <Button
                      label="Cancel Order"
                      variant="destructive"
                      block
                      loading={busy}
                      disabled={reason.trim().length < 3}
                      onPress={() => void cancel()}
                    />
                    <Button
                      label="Keep Order"
                      variant="tertiary"
                      block
                      onPress={() => setCancelOpen(false)}
                    />
                  </Panel>
                ) : (
                  <Button
                    label="Cancel Order"
                    variant="tertiary"
                    block
                    onPress={() => setCancelOpen(true)}
                  />
                )}
                {order.status === "Created" ? (
                  <Button
                    label="Delete Order"
                    variant="tertiary"
                    block
                    onPress={() => void remove()}
                  />
                ) : null}
                {actionError ? (
                  <Text variant="caption" tone="red">
                    {actionError}
                  </Text>
                ) : null}
              </View>
            ) : order.cancelReason ? (
              <Panel tone="red">
                <Text variant="caption" tone="redDark">
                  Cancelled: {order.cancelReason}
                </Text>
              </Panel>
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
  actions: { gap: space.md, marginTop: space.lg },
  cancelPanel: { gap: space.md },
  originRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  originText: { flex: 1 },
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
