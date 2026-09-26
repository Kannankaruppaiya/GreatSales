/**
 * 03G — Add Follow-up.
 *
 * Reached from an opportunity (`leadId`), a customer (`customerId`), an invoice
 * (`invoiceId`), or from the + launcher with none of them, in which case the
 * customer is chosen here. The record it was opened from is what the task is
 * attached to, so it shows up on that record's timeline as well as on the
 * Follow-ups list.
 *
 * A follow-up is planned by the day. That is the data model the web console,
 * the dashboard and the overdue counts all share, so there is no time field:
 * an hour typed here would be kept nowhere and shown to nobody.
 */
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, User } from "lucide-react-native";

import { AppBar, Button, Input, Panel, Screen, Text } from "@/components/ui";
import {
  DatePickerSheet,
  EntityPickerSheet,
  OptionSheet,
  PickerField,
  toDateKey,
  type EntityOption,
} from "@/components/form";
import { describeError } from "@/data/http";
import { useData } from "@/data/provider";
import type { EntityRef } from "@/data/source";
import { color, space } from "@/design/tokens";
import { longDate, money } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { leave } from "@/lib/nav";

const PURPOSES = [
  "Site visit",
  "Phone call",
  "Pricing discussion",
  "Sample review",
  "Quotation follow-up",
  "Payment discussion",
  "Order confirmation",
  "Other",
] as const;

export default function NewFollowUpScreen() {
  const params = useLocalSearchParams<{
    leadId?: string;
    customerId?: string;
    invoiceId?: string;
  }>();
  const router = useRouter();
  const source = useData();

  const [customer, setCustomer] = useState<EntityOption | null>(null);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(() => toDateKey(new Date()));
  const [notes, setNotes] = useState("");

  const [sheet, setSheet] = useState<"customer" | "purpose" | "date" | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The record the screen was opened from decides what the task is about.
  const context = useAsync(async () => {
    const [lead, fromCustomer, invoice] = await Promise.all([
      params.leadId ? source.getLead(params.leadId) : null,
      params.customerId ? source.getCustomer(params.customerId) : null,
      params.invoiceId ? source.getInvoice(params.invoiceId) : null,
    ]);
    return { lead, customer: fromCustomer, invoice };
  }, [source, params.leadId, params.customerId, params.invoiceId]);

  const lead = context.data?.lead ?? null;
  const invoice = context.data?.invoice ?? null;
  const lockedCustomerName =
    lead?.customerName ??
    invoice?.customerName ??
    context.data?.customer?.name ??
    null;

  /** What the follow-up is attached to. */
  const target: EntityRef | null = lead
    ? { entityType: "Lead", entityId: lead.id }
    : invoice
      ? { entityType: "Payment", entityId: invoice.id }
      : context.data?.customer
        ? { entityType: "Customer", entityId: context.data.customer.id }
        : customer
          ? { entityType: "Customer", entityId: customer.id }
          : null;

  const loadCustomers = useCallback(
    async (search: string): Promise<EntityOption[]> => {
      const page = await source.listCustomers({
        search: search || undefined,
        limit: 25,
      });
      return page.items.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: row.area ?? row.industryName,
      }));
    },
    [source],
  );

  const today = useMemo(() => toDateKey(new Date()), []);
  const ready = Boolean(target && purpose && date);

  async function save() {
    if (!ready || !target || !purpose || !date) return;
    setSaving(true);
    setError(null);
    try {
      await source.createFollowUp({
        ...target,
        purpose,
        notes: notes.trim() || null,
        dueDate: date,
      });
      leave(router, "/followups");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen bleed>
      <AppBar title="Add Follow-up" />

      <View style={styles.body}>
        {lead ? (
          <Panel tone="mint">
            <Text variant="caption" tone="muted">
              Opportunity
            </Text>
            <Text variant="cardTitle">
              {lead.products[0]?.productName ?? lead.customerName}
            </Text>
            <Text variant="caption" tone="muted">
              {lead.customerName}
            </Text>
          </Panel>
        ) : invoice ? (
          <Panel tone="mint">
            <Text variant="caption" tone="muted">
              Invoice
            </Text>
            <Text variant="cardTitle">{invoice.invoiceNumber}</Text>
            <Text variant="caption" tone="muted">
              {invoice.customerName} · {money(invoice.pending)} pending
            </Text>
          </Panel>
        ) : null}

        <PickerField
          label="Customer"
          value={lockedCustomerName ?? customer?.title ?? null}
          placeholder="Choose a customer"
          disabled={lockedCustomerName != null}
          hint={
            lead
              ? "Taken from the opportunity"
              : invoice
                ? "Taken from the invoice"
                : undefined
          }
          icon={<User size={16} color={color.muted} strokeWidth={2} />}
          onPress={() => setSheet("customer")}
        />

        <PickerField
          label="Follow-up"
          value={purpose}
          placeholder="What is this follow-up for?"
          onPress={() => setSheet("purpose")}
        />

        <PickerField
          label="Date"
          value={date ? longDate(date) : null}
          placeholder="Pick a date"
          icon={<CalendarDays size={16} color={color.muted} strokeWidth={2} />}
          onPress={() => setSheet("date")}
        />

        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything worth remembering before the call"
          multiline
          numberOfLines={4}
          hint="Optional"
        />

        {error ? (
          <Text variant="caption" tone="red">
            {error}
          </Text>
        ) : null}

        <Button
          label="Save Follow-up"
          block
          disabled={!ready}
          loading={saving}
          onPress={save}
          style={styles.save}
        />
      </View>

      <EntityPickerSheet
        visible={sheet === "customer"}
        onClose={() => setSheet(null)}
        title="Choose a customer"
        placeholder="Search customers"
        load={loadCustomers}
        selectedId={customer?.id}
        onSelect={setCustomer}
      />
      <OptionSheet
        visible={sheet === "purpose"}
        onClose={() => setSheet(null)}
        title="Follow-up for"
        options={PURPOSES.map((p) => ({ value: p, label: p }))}
        value={purpose as (typeof PURPOSES)[number] | null}
        onChange={(next) => setPurpose(next)}
      />
      <DatePickerSheet
        visible={sheet === "date"}
        onClose={() => setSheet(null)}
        value={date}
        onChange={setDate}
        min={today}
        title="Follow-up date"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
  save: { marginTop: space.md },
});
