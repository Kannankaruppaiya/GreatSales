/**
 * 03G — Add Follow-up.
 *
 * Reached from an opportunity (with `leadId`), from a customer (with
 * `customerId`) or from the + launcher with neither, in which case the
 * customer is chosen here.
 *
 * Date and time are kept as separate fields and combined on save, because that
 * is how a person says it — "Thursday, four o'clock" — and because a single
 * datetime control is the worst thing on a phone form.
 */
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Clock, User } from "lucide-react-native";

import { AppBar, Button, Input, Panel, Screen, Text } from "@/components/ui";
import {
  DatePickerSheet,
  EntityPickerSheet,
  OptionSheet,
  PickerField,
  TimePickerSheet,
  formatSlot,
  toDateKey,
  type EntityOption,
} from "@/components/form";
import { useData } from "@/data/provider";
import { isMutable } from "@/data/source";
import { color, space } from "@/design/tokens";
import { longDate } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/**
 * The reasons a follow-up gets scheduled. A fixed list rather than free text
 * so the follow-up lists can group by it; "Other" keeps the notes field as the
 * escape hatch instead of forcing a wrong choice.
 */
const PURPOSES = [
  "Site visit",
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
  }>();
  const router = useRouter();
  const source = useData();

  const [customer, setCustomer] = useState<EntityOption | null>(null);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(() => toDateKey(new Date()));
  const [time, setTime] = useState<string | null>("10:00");
  const [notes, setNotes] = useState("");

  const [sheet, setSheet] = useState<
    "customer" | "purpose" | "date" | "time" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the screen is opened from a deal, the customer is already decided.
  const context = useAsync(async () => {
    const lead = params.leadId ? await source.getLead(params.leadId) : null;
    const fromCustomer = params.customerId
      ? await source.getCustomer(params.customerId)
      : null;
    return { lead, customer: fromCustomer };
  }, [source, params.leadId, params.customerId]);

  const lockedCustomerName =
    context.data?.lead?.customerName ?? context.data?.customer?.name ?? null;

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
  const ready = Boolean(
    (lockedCustomerName || customer) && purpose && date && time,
  );

  async function save() {
    if (!ready || !isMutable(source)) return;
    setSaving(true);
    setError(null);
    try {
      const lead = context.data?.lead ?? null;
      const customerId = lead
        ? await resolveCustomerId(lead.customerName)
        : (context.data?.customer?.id ?? customer?.id ?? null);
      const customerName = lockedCustomerName ?? customer?.title ?? "";
      if (!customerId) throw new Error("This customer could not be matched.");

      await source.createFollowUp({
        leadId: lead?.id ?? null,
        customerId,
        customerName,
        purpose: purpose!,
        notes: notes.trim() || null,
        // Local time, deliberately: a follow-up at 4pm means 4pm here.
        dueAt: new Date(`${date}T${time}:00`).toISOString(),
      });
      router.back();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The follow-up could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  /** Leads carry a customer name, not an id, so the id is looked up by name. */
  async function resolveCustomerId(name: string): Promise<string | null> {
    const page = await source.listCustomers({ search: name, limit: 10 });
    return (
      page.items.find((c) => c.name === name)?.id ?? page.items[0]?.id ?? null
    );
  }

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="Add Follow-up" />

      <View style={styles.body}>
        {context.data?.lead ? (
          <Panel tone="mint">
            <Text variant="caption" tone="muted">
              Opportunity
            </Text>
            <Text variant="cardTitle">
              {context.data.lead.products[0]?.productName ??
                context.data.lead.customerName}
            </Text>
            <Text variant="caption" tone="muted">
              {context.data.lead.customerName}
            </Text>
          </Panel>
        ) : null}

        <PickerField
          label="Customer"
          value={lockedCustomerName ?? customer?.title ?? null}
          placeholder="Choose a customer"
          disabled={lockedCustomerName != null}
          hint={lockedCustomerName ? "Taken from the opportunity" : undefined}
          icon={<User size={16} color={color.muted} strokeWidth={2} />}
          onPress={() => setSheet("customer")}
        />

        <PickerField
          label="Follow-up"
          value={purpose}
          placeholder="What is this follow-up for?"
          onPress={() => setSheet("purpose")}
        />

        <View style={styles.pair}>
          <View style={styles.pairItem}>
            <PickerField
              label="Date"
              value={date ? longDate(date) : null}
              placeholder="Pick a date"
              icon={
                <CalendarDays size={16} color={color.muted} strokeWidth={2} />
              }
              onPress={() => setSheet("date")}
            />
          </View>
          <View style={styles.pairItem}>
            <PickerField
              label="Time"
              value={time ? formatSlot(time) : null}
              placeholder="Pick a time"
              icon={<Clock size={16} color={color.muted} strokeWidth={2} />}
              onPress={() => setSheet("time")}
            />
          </View>
        </View>

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
      <TimePickerSheet
        visible={sheet === "time"}
        onClose={() => setSheet(null)}
        value={time}
        onChange={setTime}
        title="Follow-up time"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
  pair: { flexDirection: "row", gap: space.md },
  pairItem: { flex: 1 },
  save: { marginTop: space.md },
});
