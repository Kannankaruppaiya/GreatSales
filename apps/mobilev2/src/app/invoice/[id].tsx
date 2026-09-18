/**
 * 09F / 09G / 09H — Invoice, payment history and collection follow-ups.
 *
 * READ ONLY. The payments listed here were recorded elsewhere; this screen
 * shows them and offers nothing that would add, change or chase one. The only
 * action is to schedule a follow-up, which is a sales record rather than a
 * payment one — a salesperson may plan a conversation, not move money.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarPlus, Info } from "lucide-react-native";

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
import { color, space } from "@/design/tokens";
import { longDate, money } from "@/lib/format";
import { PAY_ZONE_LABELS, PAY_ZONE_TONES } from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const source = useData();

  const state = useAsync(async () => {
    const invoice = id ? await source.getInvoice(id) : null;
    if (!invoice) return { invoice: null, payments: [], followUps: [] };
    const [payments, followUps] = await Promise.all([
      source.listPaymentRecords({ invoiceId: invoice.id, limit: 50 }),
      source.listFollowUps({ customerId: invoice.customerId, limit: 20 }),
    ]);
    return { invoice, payments: payments.items, followUps: followUps.items };
  }, [source, id]);

  const invoice = state.data?.invoice ?? null;
  const overdue = (invoice?.agingDays ?? 0) > 0;

  return (
    <Screen tabBarSpacing bleed onRefresh={state.reload} refreshing={state.refreshing}>
      <AppBar title="Invoice" />

      <View style={styles.body}>
        {state.loading ? (
          <SkeletonList rows={3} />
        ) : !invoice ? (
          <EmptyState
            title="Invoice not found"
            body="It may have been removed since this screen was opened."
            actionLabel="Back to Payments"
            onAction={() => router.replace("/payments")}
          />
        ) : (
          <>
            <Card>
              <View style={styles.headRow}>
                <View style={styles.headText}>
                  <Text variant="section">{invoice.invoiceNumber}</Text>
                  <Text variant="body" tone="muted" numberOfLines={1}>
                    {invoice.customerName}
                  </Text>
                </View>
                {invoice.payZone ? (
                  <Chip
                    label={PAY_ZONE_LABELS[invoice.payZone]}
                    tone={PAY_ZONE_TONES[invoice.payZone]}
                  />
                ) : null}
              </View>
            </Card>

            {overdue ? (
              <Panel tone="red">
                <Text variant="section" tone="redDark">
                  {invoice.agingDays} days overdue
                </Text>
                <Text variant="caption" tone="redDark">
                  Due on {longDate(invoice.dueAt)}
                </Text>
              </Panel>
            ) : null}

            <Panel style={styles.panel}>
              <KeyValueRow label="Invoice amount" value={money(invoice.amount)} />
              <RowDivider />
              <KeyValueRow label="Received" value={money(invoice.received)} />
              <RowDivider />
              <KeyValueRow label="Pending" value={money(invoice.pending)} />
              <RowDivider />
              <KeyValueRow label="Due" value={longDate(invoice.dueAt)} />
              <RowDivider />
              <KeyValueRow
                label="Status"
                value={
                  invoice.pending === 0
                    ? "Settled"
                    : overdue
                      ? `Overdue by ${invoice.agingDays} days`
                      : "Not due yet"
                }
              />
            </Panel>

            <Text variant="section" style={styles.heading}>
              Payment history
            </Text>
            {state.data?.payments.length === 0 ? (
              <Panel>
                <Text variant="body" tone="muted">
                  Nothing received against this invoice yet.
                </Text>
              </Panel>
            ) : (
              <Card flush>
                {state.data?.payments.map((payment, index) => (
                  <View key={payment.id}>
                    {index > 0 ? <RowDivider /> : null}
                    <View style={styles.paymentRow}>
                      <View style={styles.headText}>
                        <Text variant="cardTitle">{money(payment.amount)}</Text>
                        <Text variant="caption" tone="muted">
                          {longDate(payment.receivedAt)}
                        </Text>
                      </View>
                      <Text variant="caption" tone="muted2">
                        {payment.reference}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            <Text variant="section" style={styles.heading}>
              Collection follow-ups
            </Text>
            {state.data?.followUps.length === 0 ? (
              <Panel>
                <Text variant="body" tone="muted">
                  No follow-ups recorded with this customer.
                </Text>
              </Panel>
            ) : (
              state.data?.followUps.slice(0, 6).map((followUp) => (
                <Card
                  key={followUp.id}
                  onPress={() => router.push(`/followup/${followUp.id}`)}
                  style={styles.followUpRow}
                >
                  <View style={styles.headRow}>
                    <View style={styles.headText}>
                      <Text variant="cardTitle" numberOfLines={1}>
                        {followUp.purpose}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {longDate(followUp.dueAt)}
                      </Text>
                    </View>
                    {followUp.completedAt ? <Chip label="Done" tone="mint" /> : null}
                  </View>
                </Card>
              ))
            )}

            <Button
              label="Schedule a Follow-up"
              variant="secondary"
              block
              icon={<CalendarPlus size={16} color={color.primary} strokeWidth={2} />}
              onPress={() => router.push(`/followup/new?customerId=${invoice.customerId}`)}
              style={styles.heading}
            />

            <Panel>
              <View style={styles.noteRow}>
                <Info size={16} color={color.muted} strokeWidth={2} />
                <Text variant="caption" tone="muted" style={styles.noteText}>
                  Payments are read-only on mobile. Recording a payment, editing one or sending a
                  reminder happens in the web console.
                </Text>
              </View>
            </Panel>
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
  panel: { paddingVertical: space.xs },
  heading: { marginTop: space.sm },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
  },
  followUpRow: { paddingVertical: space.md },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  noteText: { flex: 1 },
});
