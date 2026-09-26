/**
 * 05E–05K — Customer 360.
 *
 * One screen with a tab rail rather than seven routes, because that is what a
 * 360 view is: the same account seen from different sides. The header carries
 * the identity and the figures that matter on every tab; the rail switches
 * what is listed below it.
 *
 * The Outstanding tab is read-only and has no action that would change a
 * payment. The sales role holds `payment.read` and not `payment.write`, and
 * the write interface this screen is handed has no payment method at all.
 */
import React, { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Building2,
  CalendarPlus,
  ChevronRight,
  Mail,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  Phone,
  Plus,
  ShoppingCart,
} from "lucide-react-native";

import {
  AppBar,
  Avatar,
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
import { LocationPinButton } from "@/components/form";
import { useData } from "@/data/provider";
import { color, radius, space } from "@/design/tokens";
import { longDate, money, moneyShort } from "@/lib/format";
import {
  CUSTOMER_CATEGORY_LABELS,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_TONES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PAYMENT_TERMS_LABELS,
  PAY_ZONE_LABELS,
  PAY_ZONE_TONES,
} from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";
import { confirmAction } from "@/lib/confirm";
import { leave } from "@/lib/nav";
import { describeError } from "@/data/http";

type Tab =
  | "overview"
  | "contacts"
  | "products"
  | "orders"
  | "payments"
  | "activity"
  | "location";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "contacts", label: "Contacts" },
  { key: "products", label: "Products" },
  { key: "orders", label: "Orders" },
  { key: "payments", label: "Outstanding" },
  { key: "activity", label: "Activity" },
  { key: "location", label: "Location" },
];

export default function Customer360Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const source = useData();
  const [tab, setTab] = useState<Tab>("overview");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  async function saveNote() {
    const text = note.trim();
    const row = state.data?.customer;
    if (!row || !text) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      await source.addRemark(
        { entityType: "Customer", entityId: row.id },
        text,
      );
      setNote("");
      state.reload();
    } catch (e) {
      setNoteError(describeError(e));
    } finally {
      setSavingNote(false);
    }
  }

  async function removeCustomer() {
    const row = state.data?.customer;
    if (!row) return;
    const ok = await confirmAction({
      title: "Delete this customer?",
      message: `${row.name} will leave your customer list. Their orders, invoices and history stay on record.`,
      confirmLabel: "Delete",
      cancelLabel: "Keep it",
      destructive: true,
    });
    if (!ok) return;
    try {
      await source.deleteCustomer(row.id);
      leave(router, "/(tabs)/customers");
    } catch (e) {
      setDeleteError(describeError(e));
    }
  }

  const state = useAsync(async () => {
    const customer = id ? await source.getCustomer(id) : null;
    if (!customer) return null;

    const [mappings, orders, invoices, followUps, leads, timeline] =
      await Promise.all([
        source.listMappings({ customerId: customer.id, limit: 50 }),
        source.listOrders({ customerId: customer.id, limit: 30 }),
        source.listInvoices({ customerId: customer.id, limit: 50 }),
        source.listFollowUps({ customerId: customer.id, limit: 30 }),
        source.listLeads({ search: customer.name, limit: 30 }),
        source.listActivities({
          entityType: "Customer",
          entityId: customer.id,
        }),
      ]);

    return {
      customer,
      mappings: mappings.items,
      orders: orders.items,
      invoices: invoices.items,
      followUps: followUps.items,
      // Remarks are the account's notes — the same record the web console's
      // "Remarks history" shows, so a note typed on either appears on both.
      notes: timeline.filter((a) => a.kind === "Note"),
      leads: leads.items.filter((l) => l.customerName === customer.name),
    };
  }, [source, id]);

  const customer = state.data?.customer ?? null;
  const invoices = state.data?.invoices ?? [];

  const outstanding = useMemo(() => {
    const pending = invoices.reduce((sum, i) => sum + i.pending, 0);
    const overdue = invoices
      .filter((i) => i.overdueDays > 0)
      .reduce((sum, i) => sum + i.pending, 0);
    const oldest = invoices.reduce((max, i) => Math.max(max, i.agingDays), 0);
    return { pending, overdue, oldest };
  }, [invoices]);

  async function open(url: string, what: string) {
    try {
      if (!(await Linking.canOpenURL(url))) throw new Error("unsupported");
      await Linking.openURL(url);
    } catch {
      Alert.alert(`Cannot open ${what}`, "This device has no app for that.");
    }
  }

  const phone = customer?.primaryContactPhone ?? null;

  return (
    <Screen
      tabBarSpacing
      bleed
      onRefresh={state.reload}
      refreshing={state.refreshing}
    >
      <AppBar title="Customer" />

      {state.loading ? (
        <View style={styles.body}>
          <SkeletonList rows={4} />
        </View>
      ) : !customer ? (
        <View style={styles.body}>
          <EmptyState
            title="Customer not found"
            body="It may have been removed, or it belongs to another salesperson."
            actionLabel="Back to Customers"
            onAction={() => router.replace("/(tabs)/customers")}
          />
        </View>
      ) : (
        <>
          <View style={styles.body}>
            <Card style={styles.identity}>
              <View style={styles.identityRow}>
                <Avatar name={customer.name} size={52} />
                <View style={styles.identityText}>
                  <Text variant="section" numberOfLines={2}>
                    {customer.name}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {[customer.industryName, customer.area]
                      .filter(Boolean)
                      .join(" · ") || "No industry or area recorded"}
                  </Text>
                </View>
              </View>

              <View style={styles.chips}>
                {customer.category ? (
                  <Chip
                    label={CUSTOMER_CATEGORY_LABELS[customer.category]}
                    tone="neutral"
                  />
                ) : null}
                {customer.payZone ? (
                  <Chip
                    label={PAY_ZONE_LABELS[customer.payZone]}
                    tone={PAY_ZONE_TONES[customer.payZone]}
                  />
                ) : null}
                {customer.paymentTerms ? (
                  <Chip
                    label={PAYMENT_TERMS_LABELS[customer.paymentTerms]}
                    tone="neutral"
                  />
                ) : null}
              </View>

              <RowDivider />

              <View style={styles.quickRow}>
                {phone ? (
                  <QuickAction
                    label="Call"
                    Icon={Phone}
                    onPress={() =>
                      open(`tel:${phone.replace(/\s/g, "")}`, "the dialler")
                    }
                  />
                ) : null}
                {phone ? (
                  <QuickAction
                    label="Message"
                    Icon={MessageSquare}
                    onPress={() =>
                      open(
                        `${Platform.OS === "ios" ? "sms:" : "smsto:"}${phone.replace(/\s/g, "")}`,
                        "messages",
                      )
                    }
                  />
                ) : null}
                <QuickAction
                  label="Follow-up"
                  Icon={CalendarPlus}
                  onPress={() =>
                    router.push(`/followup/new?customerId=${customer.id}`)
                  }
                />
                <QuickAction
                  label="New Lead"
                  Icon={Plus}
                  onPress={() =>
                    router.push(`/lead/new?customerId=${customer.id}`)
                  }
                />
              </View>
            </Card>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {TABS.map((entry) => (
              <Chip
                key={entry.key}
                label={entry.label}
                active={tab === entry.key}
                onPress={() => setTab(entry.key)}
              />
            ))}
          </ScrollView>

          <View style={styles.body}>
            {tab === "overview" ? (
              <>
                <View style={styles.metrics}>
                  <Metric
                    label="Outstanding"
                    value={moneyShort(outstanding.pending)}
                  />
                  <Metric
                    label="Overdue"
                    value={moneyShort(outstanding.overdue)}
                  />
                  <Metric
                    label="Open deals"
                    value={String(state.data?.leads.length ?? 0)}
                  />
                  <Metric
                    label="Orders"
                    value={String(state.data?.orders.length ?? 0)}
                  />
                </View>

                <Panel style={styles.panel}>
                  <KeyValueRow
                    label="Industry"
                    value={customer.industryName}
                    emptyText="Not set"
                  />
                  <RowDivider />
                  <KeyValueRow
                    label="Area"
                    value={customer.area}
                    emptyText="Not set"
                  />
                  <RowDivider />
                  <KeyValueRow
                    label="Key contact"
                    value={customer.primaryContactName}
                    emptyText="No contact recorded"
                  />
                  <RowDivider />
                  <KeyValueRow
                    label="Phone"
                    value={customer.primaryContactPhone}
                    emptyText="Not set"
                  />
                  <RowDivider />
                  <KeyValueRow
                    label="Payment terms"
                    value={
                      customer.paymentTerms
                        ? PAYMENT_TERMS_LABELS[customer.paymentTerms]
                        : null
                    }
                    emptyText="Not set"
                  />
                  <RowDivider />
                  <KeyValueRow
                    label="Salesperson"
                    value={customer.salespersonName}
                  />
                </Panel>

                {state.data && state.data.leads.length > 0 ? (
                  <View style={styles.section}>
                    <Text variant="section">Open opportunities</Text>
                    {state.data.leads.slice(0, 5).map((lead) => (
                      <Card
                        key={lead.id}
                        onPress={() => router.push(`/lead/${lead.id}`)}
                        style={styles.row}
                      >
                        <View style={styles.rowInner}>
                          <View style={styles.rowText}>
                            <Text variant="cardTitle" numberOfLines={1}>
                              {lead.products[0]?.productName ??
                                lead.customerName}
                            </Text>
                            <Text variant="caption" tone="muted">
                              {money(lead.totalValue)}
                            </Text>
                          </View>
                          <Chip
                            label={DEAL_STAGE_LABELS[lead.stage]}
                            tone={DEAL_STAGE_TONES[lead.stage]}
                          />
                        </View>
                      </Card>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {tab === "contacts" ? (
              customer.contacts.length === 0 ? (
                <EmptyState
                  title="No contacts yet"
                  body="Add who you deal with at this account so calls and emails are one tap away."
                />
              ) : (
                <View style={styles.section}>
                  {customer.contacts.map((contact) => (
                    <Card key={contact.id} style={styles.row}>
                      <View style={styles.rowInner}>
                        <Avatar name={contact.name} size={40} />
                        <View style={styles.rowText}>
                          <Text variant="cardTitle" numberOfLines={1}>
                            {contact.name}
                          </Text>
                          <Text
                            variant="caption"
                            tone="muted"
                            numberOfLines={1}
                          >
                            {contact.designation ?? "No designation recorded"}
                          </Text>
                        </View>
                        {contact.isPrimary ? (
                          <Chip label="Primary" tone="mint" />
                        ) : null}
                      </View>

                      {contact.phone || contact.email ? (
                        <>
                          <RowDivider />
                          <View style={styles.contactActions}>
                            {contact.phone ? (
                              <QuickAction
                                label="Call"
                                Icon={Phone}
                                onPress={() =>
                                  open(
                                    `tel:${contact.phone!.replace(/\s/g, "")}`,
                                    "the dialler",
                                  )
                                }
                              />
                            ) : null}
                            {contact.email ? (
                              <QuickAction
                                label="Email"
                                Icon={Mail}
                                onPress={() =>
                                  open(`mailto:${contact.email}`, "mail")
                                }
                              />
                            ) : null}
                          </View>
                        </>
                      ) : null}
                    </Card>
                  ))}
                </View>
              )
            ) : null}

            {tab === "products" ? (
              (state.data?.mappings.length ?? 0) === 0 ? (
                <EmptyState
                  title="No products mapped"
                  body="Map the products this customer buys so their agreed prices carry into quotes and orders."
                  actionLabel="Create a mapping"
                  onAction={() =>
                    router.push(`/mappings/new?customerId=${customer.id}`)
                  }
                />
              ) : (
                <View style={styles.section}>
                  {state.data?.mappings.map((mapping) => (
                    <Card
                      key={mapping.id}
                      onPress={() => router.push(`/mapping/${mapping.id}`)}
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
                            {mapping.productName}
                          </Text>
                          <Text
                            variant="caption"
                            tone="muted"
                            numberOfLines={1}
                          >
                            {mapping.principal}
                          </Text>
                        </View>
                        <View style={styles.priceCol}>
                          <Text variant="cardTitle">
                            {money(mapping.agreedPrice ?? mapping.listPrice)}
                          </Text>
                          <Text
                            variant="nano"
                            tone={
                              mapping.agreedPrice != null
                                ? "primaryDark"
                                : "muted2"
                            }
                          >
                            {mapping.agreedPrice != null
                              ? "Agreed"
                              : "List price"}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              )
            ) : null}

            {tab === "orders" ? (
              (state.data?.orders.length ?? 0) === 0 ? (
                <EmptyState
                  title="No orders yet"
                  body="Create an order from an opportunity, or start one from the + button."
                  actionLabel="New order"
                  onAction={() =>
                    router.push(`/order/new?customerId=${customer.id}`)
                  }
                />
              ) : (
                <View style={styles.section}>
                  {state.data?.orders.map((order) => (
                    <Card
                      key={order.id}
                      onPress={() => router.push(`/order/${order.id}`)}
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
                          <Text variant="cardTitle">{order.soNumber}</Text>
                          <Text
                            variant="caption"
                            tone="muted"
                            numberOfLines={1}
                          >
                            {order.lines.length}{" "}
                            {order.lines.length === 1 ? "product" : "products"}{" "}
                            · {longDate(order.issuedAt)}
                          </Text>
                        </View>
                        <View style={styles.priceCol}>
                          <Text variant="cardTitle">
                            {moneyShort(order.total)}
                          </Text>
                          <Chip
                            label={ORDER_STATUS_LABELS[order.status]}
                            tone={ORDER_STATUS_TONES[order.status]}
                          />
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              )
            ) : null}

            {tab === "payments" ? (
              <View style={styles.section}>
                <Panel
                  tone={outstanding.overdue > 0 ? "red" : "mint"}
                  style={styles.panel}
                >
                  <KeyValueRow
                    label="Outstanding"
                    value={money(outstanding.pending)}
                  />
                  <RowDivider />
                  <KeyValueRow
                    label="Overdue"
                    value={money(outstanding.overdue)}
                  />
                  <RowDivider />
                  <KeyValueRow
                    label="Oldest overdue"
                    value={
                      outstanding.oldest > 0
                        ? `${outstanding.oldest} days`
                        : "Nothing overdue"
                    }
                  />
                </Panel>

                {invoices.length === 0 ? (
                  <EmptyState
                    title="No invoices"
                    body="Nothing has been billed to this account yet."
                  />
                ) : (
                  invoices.map((invoice) => (
                    <Card
                      key={invoice.id}
                      onPress={() => router.push(`/invoice/${invoice.id}`)}
                      style={styles.row}
                    >
                      <View style={styles.rowInner}>
                        <View style={styles.rowText}>
                          <Text variant="cardTitle">
                            {invoice.invoiceNumber}
                          </Text>
                          <Text variant="caption" tone="muted">
                            {invoice.dueAt
                              ? `Due ${longDate(invoice.dueAt)}`
                              : `${invoice.agingDays} days old`}
                          </Text>
                        </View>
                        <View style={styles.priceCol}>
                          <Text variant="cardTitle">
                            {money(invoice.pending)}
                          </Text>
                          {invoice.overdueDays > 0 ? (
                            <Text variant="nano" tone="red">
                              {invoice.overdueDays} days overdue
                            </Text>
                          ) : (
                            <Text variant="nano" tone="muted2">
                              Not due yet
                            </Text>
                          )}
                        </View>
                      </View>
                    </Card>
                  ))
                )}

                <Text variant="nano" tone="muted2">
                  Payments are read-only for a salesperson. Recording or editing
                  one happens in the web console.
                </Text>
              </View>
            ) : null}

            {tab === "activity" ? (
              <>
                <Text variant="section" style={styles.section}>
                  Follow-ups
                </Text>
                {(state.data?.followUps.length ?? 0) === 0 ? (
                  <EmptyState
                    title="No follow-ups"
                    body="Schedule the next contact so it shows up on your home screen."
                    actionLabel="Add a follow-up"
                    onAction={() =>
                      router.push(`/followup/new?customerId=${customer.id}`)
                    }
                  />
                ) : (
                  <View style={styles.section}>
                    {state.data?.followUps.map((followUp) => (
                      <Card
                        key={followUp.id}
                        onPress={() => router.push(`/followup/${followUp.id}`)}
                        style={styles.row}
                      >
                        <View style={styles.rowInner}>
                          <View style={styles.rowText}>
                            <Text variant="cardTitle" numberOfLines={1}>
                              {followUp.purpose}
                            </Text>
                            <Text variant="caption" tone="muted">
                              {longDate(followUp.dueAt)}
                            </Text>
                          </View>
                          {followUp.done ? (
                            <Chip label="Done" tone="mint" />
                          ) : (
                            <ChevronRight
                              size={15}
                              color={color.muted2}
                              strokeWidth={2}
                            />
                          )}
                        </View>
                      </Card>
                    ))}
                  </View>
                )}

                <Text variant="section" style={styles.section}>
                  Notes
                </Text>
                <View style={styles.section}>
                  <Input
                    label="Add a note"
                    value={note}
                    onChangeText={setNote}
                    placeholder="What was discussed on this visit or call"
                    multiline
                    numberOfLines={3}
                  />
                  {noteError ? (
                    <Text variant="caption" tone="red">
                      {noteError}
                    </Text>
                  ) : null}
                  <Button
                    label="Save Note"
                    variant="secondary"
                    block
                    loading={savingNote}
                    disabled={note.trim().length === 0}
                    onPress={saveNote}
                  />
                  {(state.data?.notes.length ?? 0) === 0 ? (
                    <Text variant="caption" tone="muted">
                      No notes on this account yet.
                    </Text>
                  ) : (
                    state.data?.notes.map((n) => (
                      <Card key={n.id} style={styles.row}>
                        <Text variant="body">{n.summary}</Text>
                        <Text variant="caption" tone="muted">
                          {longDate(n.at)}
                          {n.actorName ? ` · ${n.actorName}` : ""}
                        </Text>
                      </Card>
                    ))
                  )}
                </View>
              </>
            ) : null}

            {tab === "location" ? (
              <View style={styles.section}>
                <Panel style={styles.panel}>
                  <KeyValueRow
                    label="Area"
                    value={customer.area}
                    emptyText="Not set"
                  />
                  <RowDivider />
                  <KeyValueRow
                    label="Pinned"
                    value={
                      customer.locationPinnedAt
                        ? `${longDate(customer.locationPinnedAt)}${
                            customer.locationPinnedByName
                              ? ` by ${customer.locationPinnedByName}`
                              : ""
                          }`
                        : null
                    }
                    emptyText="This account has no pinned location"
                  />
                  {customer.locationAccuracyM != null ? (
                    <>
                      <RowDivider />
                      <KeyValueRow
                        label="Accuracy"
                        value={`± ${customer.locationAccuracyM} m`}
                      />
                    </>
                  ) : null}
                </Panel>

                {customer.locationUrl ? (
                  <Button
                    label="Open in Maps"
                    block
                    icon={
                      <Navigation
                        size={16}
                        color={color.surfaceWhite}
                        strokeWidth={2.5}
                      />
                    }
                    onPress={() => open(customer.locationUrl!, "maps")}
                  />
                ) : (
                  <EmptyState
                    title="No location pinned"
                    body="Standing at their premises? Pin it now so the next visit — and the delivery — can find them."
                    icon={
                      <MapPin size={22} color={color.muted2} strokeWidth={2} />
                    }
                  />
                )}

                <LocationPinButton
                  label={
                    customer.locationUrl
                      ? "Re-pin at My Current Location"
                      : "Pin My Current Location"
                  }
                  onPin={async (fix) => {
                    await source.updateCustomer(customer.id, fix);
                    state.reload();
                  }}
                />
              </View>
            ) : null}

            {tab === "overview" ? (
              <View style={styles.section}>
                {deleteError ? (
                  <Text variant="caption" tone="red">
                    {deleteError}
                  </Text>
                ) : null}
                <Button
                  label="Delete Customer"
                  variant="tertiary"
                  block
                  onPress={removeCustomer}
                />
              </View>
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Panel tone="mint" style={styles.metric}>
      <Text variant="section">{value}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </Panel>
  );
}

function QuickAction({
  label,
  Icon,
  onPress,
}: {
  label: string;
  Icon: typeof Phone;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.quickAction}
    >
      <View style={styles.quickPlate}>
        <Icon size={18} color={color.primaryDark} strokeWidth={2} />
      </View>
      <Text variant="micro" tone="muted" align="center">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
  identity: { gap: space.md },
  identityRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  identityText: { flex: 1, gap: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  quickRow: { flexDirection: "row", justifyContent: "space-around" },
  quickAction: { alignItems: "center", gap: space.sm, width: 72 },
  quickPlate: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  rail: {
    gap: space.sm,
    paddingHorizontal: space.gutter,
    paddingVertical: space.lg,
  },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  metric: { width: "47.5%", gap: 2, minHeight: 70, justifyContent: "center" },
  panel: { paddingVertical: space.xs },
  section: { gap: space.md },
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
  contactActions: {
    flexDirection: "row",
    gap: space.xxl,
    paddingTop: space.md,
  },
});
