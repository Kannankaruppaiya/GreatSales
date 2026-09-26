/**
 * 02C.5 — Follow-up Detail.
 *
 * From the Penpot board "02C.5 Follow-up Detail": the customer identity card
 * with its four quick actions, the overdue banner when the date has passed,
 * the detail rows, the related opportunity, and the complete action.
 *
 * The quick actions open the phone's own dialler, messaging, mail and maps.
 * Each one is hidden when the data it needs is missing — a Call button with no
 * number to ring is a dead control, and the design's own rule is that an icon
 * appears "only when it adds meaning".
 */
import React, { useState } from "react";
import { Alert, Linking, Platform, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CircleAlert,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Target,
} from "lucide-react-native";

import {
  AppBar,
  Avatar,
  Button,
  Card,
  Chip,
  KeyValueRow,
  Panel,
  RowDivider,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { describeError } from "@/data/http";
import type { FollowUp } from "@/data/source";
import { confirmAction } from "@/lib/confirm";
import { leave } from "@/lib/nav";
import { color, radius, space } from "@/design/tokens";
import { longDate, money, daysOverdue } from "@/lib/format";
import { DEAL_STAGE_LABELS, DEAL_STAGE_TONES } from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";

export default function FollowUpDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const source = useData();

  const state = useAsync(async () => {
    const followUp = id ? await source.getFollowUp(id) : null;
    if (!followUp) return { followUp: null, customer: null, lead: null };
    const lead = followUp.leadId ? await source.getLead(followUp.leadId) : null;
    // The account behind the task, for the call / message / directions row.
    // A lead is a prospect with its own contacts and no customer record yet.
    const customerId = await customerBehind(followUp);
    const customer = customerId ? await source.getCustomer(customerId) : null;
    return { followUp, customer, lead };
  }, [source, id]);

  const followUp = state.data?.followUp ?? null;
  const customer = state.data?.customer ?? null;
  const lead = state.data?.lead ?? null;

  const phone =
    customer?.primaryContactPhone ??
    lead?.contacts.find((c) => c.isPrimary)?.phone ??
    null;
  const email =
    customer?.contacts?.[0]?.email ?? lead?.contacts?.[0]?.email ?? null;
  const mapsUrl = customer?.locationUrl ?? null;
  const late = followUp ? daysOverdue(followUp.dueAt) : 0;

  async function open(url: string, what: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("unsupported");
      await Linking.openURL(url);
    } catch {
      Alert.alert(`Cannot open ${what}`, "This device has no app for that.");
    }
  }

  async function customerBehind(f: FollowUp): Promise<string | null> {
    switch (f.entityType) {
      case "Customer":
        return f.entityId;
      case "Payment":
        return (await source.getInvoice(f.entityId))?.customerId ?? null;
      case "Order":
        return (await source.getOrder(f.entityId))?.customerId ?? null;
      case "Projection":
        return (await source.getProjection(f.entityId))?.customerId ?? null;
      default:
        return null;
    }
  }

  async function remove() {
    if (!followUp) return;
    const ok = await confirmAction({
      title: "Delete this follow-up?",
      message: `${followUp.purpose} with ${followUp.customerName} will be removed from your list.`,
      confirmLabel: "Delete",
      cancelLabel: "Keep it",
      destructive: true,
    });
    if (!ok) return;
    try {
      await source.deleteFollowUp(followUp.id);
      leave(router, "/followups");
    } catch (e) {
      setCompleteError(describeError(e));
    }
  }

  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  async function complete() {
    if (!followUp) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      await source.completeFollowUp(followUp.id);
      state.reload();
    } catch (e) {
      setCompleteError(describeError(e));
    } finally {
      setCompleting(false);
    }
  }

  return (
    <Screen bleed>
      <AppBar title="Follow-up Details" />

      <View style={styles.body}>
        {state.loading ? (
          <SkeletonList rows={3} />
        ) : !followUp ? (
          <Panel>
            <Text variant="body" tone="muted">
              This follow-up no longer exists. It may have been completed or
              removed from another device.
            </Text>
          </Panel>
        ) : (
          <>
            <Card>
              <View style={styles.identity}>
                <Avatar name={followUp.customerName} size={57} />
                <View style={styles.identityText}>
                  <Text variant="pageTitle" numberOfLines={1}>
                    {followUp.customerName}
                  </Text>
                  {customer?.primaryContactName ? (
                    <Text variant="secondary" tone="muted">
                      {customer.primaryContactName}
                    </Text>
                  ) : null}
                  {customer ? (
                    <Text
                      variant="secondary"
                      tone="primaryDark"
                      onPress={() => router.push(`/customer/${customer.id}`)}
                      style={styles.link}
                    >
                      Customer Details
                    </Text>
                  ) : null}
                </View>
              </View>

              <RowDivider />

              <View style={styles.quickActions}>
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
                {email ? (
                  <QuickAction
                    label="Email"
                    Icon={Mail}
                    onPress={() => open(`mailto:${email}`, "mail")}
                  />
                ) : null}
                {mapsUrl ? (
                  <QuickAction
                    label="Location"
                    Icon={MapPin}
                    onPress={() => open(mapsUrl, "maps")}
                  />
                ) : null}
              </View>
            </Card>

            {late > 0 && !followUp.done ? (
              <Card tone="red" style={styles.banner}>
                <View style={styles.bannerRow}>
                  <CircleAlert
                    size={20}
                    color={color.redDark}
                    strokeWidth={2}
                  />
                  <View style={styles.bannerText}>
                    <Text variant="section" tone="redDark">
                      Overdue by {late} {late === 1 ? "day" : "days"}
                    </Text>
                    <Text variant="secondary" tone="redDark">
                      Due on {longDate(followUp.dueAt)}
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}

            <Card style={styles.details} flush>
              <View style={styles.detailsInner}>
                <KeyValueRow label="Follow-up" value={followUp.purpose} />
                <RowDivider />
                <KeyValueRow
                  label="Description"
                  value={
                    [followUp.subtitle, followUp.notes]
                      .filter(Boolean)
                      .join(" — ") || null
                  }
                  emptyText="No notes yet"
                />
                <RowDivider />
                <KeyValueRow label="Due" value={longDate(followUp.dueAt)} />
                {lead ? (
                  <>
                    <RowDivider />
                    <KeyValueRow
                      label="Expected Value"
                      value={money(lead.totalValue)}
                    />
                    <RowDivider />
                    <KeyValueRow label="Stage">
                      <Chip
                        label={DEAL_STAGE_LABELS[lead.stage]}
                        tone={DEAL_STAGE_TONES[lead.stage]}
                      />
                    </KeyValueRow>
                  </>
                ) : null}
                {followUp.completedAt ? (
                  <>
                    <RowDivider />
                    <KeyValueRow
                      label="Completed"
                      value={longDate(followUp.completedAt)}
                    />
                  </>
                ) : null}
              </View>
            </Card>

            {lead ? (
              <View style={styles.related}>
                <Text variant="section" style={styles.relatedTitle}>
                  Related Opportunity
                </Text>
                <Card
                  onPress={() => router.push(`/lead/${lead.id}`)}
                  accessibilityLabel={`Opportunity, ${lead.customerName}`}
                  style={styles.relatedCard}
                >
                  <View style={styles.relatedRow}>
                    <View style={styles.relatedPlate}>
                      <Target
                        size={17}
                        color={color.primaryDark}
                        strokeWidth={2}
                      />
                    </View>
                    <Text
                      variant="cardTitle"
                      numberOfLines={1}
                      style={styles.relatedName}
                    >
                      {lead.products[0]?.productName ?? lead.customerName}
                    </Text>
                  </View>
                </Card>
              </View>
            ) : null}

            {!followUp.done ? (
              <>
                {completeError ? (
                  <Text variant="caption" tone="red">
                    {completeError}
                  </Text>
                ) : null}
                <Button
                  label="Mark as Completed"
                  block
                  loading={completing}
                  onPress={complete}
                  style={styles.complete}
                />
              </>
            ) : null}
            <Button
              label="Delete Follow-up"
              variant="tertiary"
              block
              onPress={remove}
            />
          </>
        )}
      </View>
    </Screen>
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
    <View style={styles.quickAction}>
      <Button
        label=""
        variant="mint"
        size="medium"
        onPress={onPress}
        icon={<Icon size={19} color={color.primaryDark} strokeWidth={2} />}
        style={styles.quickButton}
      />
      <Text variant="micro" tone="muted" align="center">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.xl },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingBottom: space.lg,
  },
  identityText: { flex: 1, gap: 2 },
  link: { marginTop: 2 },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: space.lg,
  },
  quickAction: { alignItems: "center", gap: space.sm, width: 72 },
  quickButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    paddingHorizontal: 0,
  },
  banner: {},
  bannerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  bannerText: { flex: 1, gap: 2 },
  details: {},
  detailsInner: { paddingHorizontal: space.xl, paddingVertical: space.xs },
  related: { gap: space.md },
  relatedTitle: {},
  relatedCard: { padding: space.lg },
  relatedRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  relatedPlate: {
    width: 31,
    height: 31,
    borderRadius: 9,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  relatedName: { flex: 1 },
  complete: { marginTop: space.sm },
});
