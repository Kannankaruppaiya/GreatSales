/**
 * 03C / 03E — Opportunity Detail.
 *
 * From the Penpot boards "03C.1 Overview" (identity card, metric grid, stage
 * selector, related records, remarks) and "03C.5 Actions" (the tab rail and the
 * activity stream). Overview and Activity are tabs on one screen, as the design
 * has them; the actions sheet is 03I.
 *
 * Probability is shown only where it can be sourced — the schema carries no
 * per-deal probability field, so the metric reads from the deal's projection
 * when one exists and is left out when it does not, rather than displaying a
 * number nothing produced.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { DealStageValue } from "@greatsales/shared";
import {
  Building2,
  Calendar,
  CalendarCheck,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  Mail,
  MessageSquare,
  Phone,
  ShoppingCart,
  Trophy,
} from "lucide-react-native";

import {
  AppBar,
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  Panel,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { ChangeStageSheet, OpportunityActionsSheet } from "@/components/modals";
import type { OpportunityAction } from "@/components/modals";
import { useData } from "@/data/provider";
import { isMutable } from "@/data/source";
import { color, font, radius, space } from "@/design/tokens";
import { longDate, money, moneyShort, percent, quantity } from "@/lib/format";
import { DEAL_STAGE_LABELS, DEAL_STAGE_TONES } from "@/lib/labels";
import { ACTIVITY_ICONS, activityGroup } from "@/lib/activity";
import { useAsync } from "@/lib/useAsync";

/** Rows shown on the detail tab before it defers to the full timeline. */
const ACTIVITY_PREVIEW = 6;

type Tab = "overview" | "activity";

export default function OpportunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const source = useData();

  const [tab, setTab] = useState<Tab>("overview");
  const [stageOpen, setStageOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const state = useAsync(async () => {
    const lead = id ? await source.getLead(id) : null;
    if (!lead)
      return {
        lead: null,
        customer: null,
        activities: [],
        projection: null,
        followUp: null,
      };

    const customers = await source.listCustomers({
      search: lead.customerName,
      limit: 5,
    });
    const customer =
      customers.items.find((c) => c.name === lead.customerName) ?? null;

    const [activities, projections, followUps] = await Promise.all([
      source.listActivities({ leadId: lead.id, limit: 40 }),
      customer
        ? source.listProjections({ customerId: customer.id, limit: 20 })
        : Promise.resolve(null),
      source.listFollowUps({ leadId: lead.id, limit: 5 }),
    ]);

    // Probability comes from the projection for this customer and product, if
    // there is one. Nothing else in the schema carries it.
    const projection =
      projections?.items.find(
        (p) => p.productId === lead.products[0]?.productId,
      ) ?? null;

    return {
      lead,
      customer,
      activities: activities.items,
      projection,
      followUp: followUps.items.find((f) => f.completedAt == null) ?? null,
    };
  }, [source, id]);

  const lead = state.data?.lead ?? null;
  const customer = state.data?.customer ?? null;
  const projection = state.data?.projection ?? null;
  const followUp = state.data?.followUp ?? null;

  async function changeStage(stage: DealStageValue) {
    if (!lead || !isMutable(source)) return;
    await source.changeLeadStage(lead.id, stage);
    state.reload();
  }

  function runAction(action: OpportunityAction) {
    if (!lead) return;
    switch (action) {
      case "change-stage":
        setStageOpen(true);
        break;
      case "add-follow-up":
        router.push(`/followup/new?leadId=${lead.id}`);
        break;
      case "create-order":
        router.push(`/order/new?leadId=${lead.id}`);
        break;
      case "edit":
        router.push(`/lead/${lead.id}/edit`);
        break;
      case "view-customer":
        if (customer) router.push(`/customer/${customer.id}`);
        break;
    }
  }

  return (
    <Screen tabBarSpacing={false} bleed>
      <AppBar
        title="Opportunity Detail"
        action={
          lead ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More actions"
              onPress={() => setActionsOpen(true)}
              hitSlop={12}
            >
              <EllipsisVertical size={20} color={color.ink} strokeWidth={2} />
            </Pressable>
          ) : null
        }
      />

      <View style={styles.body}>
        {state.loading ? (
          <SkeletonList rows={4} />
        ) : !lead ? (
          <EmptyState
            title="Opportunity not found"
            body="It may have been removed, or it belongs to another salesperson."
            actionLabel="Back to Pipeline"
            onAction={() => router.replace("/(tabs)/pipeline")}
          />
        ) : (
          <>
            <Card style={styles.identity}>
              <View style={styles.identityRow}>
                <View style={styles.identityTile}>
                  <Building2
                    size={22}
                    color={color.primaryDark}
                    strokeWidth={2}
                  />
                </View>
                <View style={styles.identityText}>
                  <Text variant="cardTitle" numberOfLines={2}>
                    {lead.products[0]?.productName ?? lead.customerName}
                  </Text>
                  <Text variant="secondary" tone="muted" numberOfLines={1}>
                    {lead.customerName}
                  </Text>
                </View>
              </View>
              <View style={styles.identityChips}>
                <Chip
                  label={DEAL_STAGE_LABELS[lead.stage]}
                  tone={DEAL_STAGE_TONES[lead.stage]}
                />
                {lead.tier ? <Chip label={lead.tier} tone="neutral" /> : null}
              </View>
            </Card>

            <View style={styles.metrics}>
              <Metric
                Icon={Trophy}
                value={moneyShort(lead.totalValue)}
                label="Deal Value"
              />
              {projection ? (
                <Metric
                  Icon={ChartColumn}
                  value={percent(projection.probability)}
                  label="Probability"
                />
              ) : null}
              <Metric
                Icon={Calendar}
                value={lead.expClose ? longDate(lead.expClose) : "Not set"}
                label="Expected Closure"
              />
              <Metric
                Icon={CalendarCheck}
                value={followUp ? longDate(followUp.dueAt) : "None"}
                label="Next Follow-up"
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Stage, ${DEAL_STAGE_LABELS[lead.stage]}. Tap to change.`}
              onPress={() => setStageOpen(true)}
              style={styles.stageRow}
            >
              <Text variant="secondary" tone="muted" style={styles.stageLabel}>
                Stage
              </Text>
              <View style={styles.stageSelect}>
                <View
                  style={[
                    styles.stageDot,
                    { backgroundColor: stageDotColor(lead.stage) },
                  ]}
                />
                <Text variant="secondary" style={styles.stageValue}>
                  {DEAL_STAGE_LABELS[lead.stage]}
                </Text>
                <ChevronDown size={16} color={color.muted} strokeWidth={2} />
              </View>
            </Pressable>

            <View style={styles.tabs}>
              {(["overview", "activity"] as Tab[]).map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === key }}
                  accessibilityLabel={
                    key === "overview" ? "Overview" : "Activity"
                  }
                  onPress={() => setTab(key)}
                  style={styles.tab}
                >
                  <Text
                    variant="secondary"
                    tone={tab === key ? "primary" : "muted"}
                    align="center"
                    style={tab === key ? styles.tabActive : undefined}
                  >
                    {key === "overview" ? "Overview" : "Activity"}
                  </Text>
                  <View
                    style={[
                      styles.tabRule,
                      tab === key ? styles.tabRuleActive : null,
                    ]}
                  />
                </Pressable>
              ))}
            </View>

            {tab === "overview" ? (
              <View style={styles.section}>
                {customer ? (
                  <RelatedRow
                    title="Customer"
                    onPress={() => router.push(`/customer/${customer.id}`)}
                  >
                    <Avatar name={customer.name} size={40} />
                    <View style={styles.relatedText}>
                      <Text variant="cardTitle" numberOfLines={1}>
                        {customer.name}
                      </Text>
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {customer.industryName ?? "Industry not set"}
                      </Text>
                      <Text variant="micro" tone="muted2" numberOfLines={1}>
                        {customer.area ?? "Area not set"}
                      </Text>
                    </View>
                  </RelatedRow>
                ) : null}

                {lead.contactName ? (
                  <View style={styles.block}>
                    <Text variant="caption" style={styles.blockTitle}>
                      Key Contact
                    </Text>
                    <Card style={styles.relatedCard}>
                      <View style={styles.relatedRow}>
                        <Avatar name={lead.contactName} size={38} />
                        <View style={styles.relatedText}>
                          <Text variant="cardTitle" numberOfLines={1}>
                            {lead.contactName}
                          </Text>
                          <Text
                            variant="caption"
                            tone="muted"
                            numberOfLines={1}
                          >
                            {lead.contacts[0]?.designation ?? "Contact"}
                          </Text>
                        </View>
                        <View style={styles.contactActions}>
                          {lead.phone ? <ContactDot Icon={Phone} /> : null}
                          {lead.phone ? (
                            <ContactDot Icon={MessageSquare} />
                          ) : null}
                          {lead.contacts[0]?.email ? (
                            <ContactDot Icon={Mail} />
                          ) : null}
                        </View>
                      </View>
                    </Card>
                  </View>
                ) : null}

                {lead.products.length > 0 ? (
                  <View style={styles.block}>
                    {/*
                     * The heading is the way into 03F, where each line is
                     * checked against the customer's mapping. Without it that
                     * screen has no entry point on the opportunity it belongs
                     * to.
                     */}
                    <View style={styles.blockHeader}>
                      <Text variant="caption" style={styles.blockTitle}>
                        Products
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Products and pricing"
                        hitSlop={8}
                        onPress={() =>
                          router.push(`/lead/${lead.id}/products`)
                        }
                        style={styles.blockAction}
                      >
                        <Text variant="caption" tone="primary">
                          Check pricing
                        </Text>
                        <ChevronRight
                          size={14}
                          color={color.primary}
                          strokeWidth={2}
                        />
                      </Pressable>
                    </View>
                    <Card flush style={styles.productCard}>
                      {lead.products.map((product, i) => (
                        <View key={product.id}>
                          {i > 0 ? <View style={styles.divider} /> : null}
                          <View style={styles.productRow}>
                            <View style={styles.productTile}>
                              <ShoppingCart
                                size={17}
                                color={color.primaryDark}
                                strokeWidth={2}
                              />
                            </View>
                            <View style={styles.relatedText}>
                              <Text variant="cardTitle" numberOfLines={1}>
                                {product.productName}
                              </Text>
                              <Text variant="caption" tone="muted">
                                {quantity(product.qty ?? 0, product.unit)}
                                {product.price
                                  ? ` · ${money(product.price)}`
                                  : ""}
                              </Text>
                            </View>
                            {product.value ? (
                              <Text variant="cardTitle">
                                {moneyShort(product.value)}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </Card>
                  </View>
                ) : null}

                <View style={styles.block}>
                  <Text variant="caption" style={styles.blockTitle}>
                    Salesperson
                  </Text>
                  <Card style={styles.relatedCard}>
                    <View style={styles.relatedRow}>
                      <Avatar name={lead.salespersonName} size={34} />
                      <View style={styles.relatedText}>
                        <Text variant="cardTitle" numberOfLines={1}>
                          {lead.salespersonName}
                        </Text>
                        <Text variant="caption" tone="muted">
                          Field Sales
                        </Text>
                      </View>
                    </View>
                  </Card>
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                {state.data && state.data.activities.length > 0 ? (
                  <>
                    <Card flush style={styles.productCard}>
                      {/* The tab is a preview; 03E.2 is the whole timeline. */}
                      {state.data.activities
                        .slice(0, ACTIVITY_PREVIEW)
                        .map((activity, i) => {
                          const Icon =
                            ACTIVITY_ICONS[activityGroup(activity.kind)];
                          return (
                            <View key={activity.id}>
                              {i > 0 ? <View style={styles.divider} /> : null}
                              <View style={styles.activityRow}>
                                <View style={styles.activityTile}>
                                  <Icon
                                    size={17}
                                    color={color.primaryDark}
                                    strokeWidth={2}
                                  />
                                </View>
                                <View style={styles.relatedText}>
                                  <Text variant="cardTitle">
                                    {activity.kind}
                                  </Text>
                                  <Text variant="caption" tone="muted">
                                    {activity.summary}
                                  </Text>
                                  <Text variant="nano" tone="muted2">
                                    {activity.actorName} ·{" "}
                                    {longDate(activity.at)}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                    </Card>

                    <Button
                      label={
                        state.data.activities.length > ACTIVITY_PREVIEW
                          ? `View all ${state.data.activities.length} activities`
                          : "View full timeline"
                      }
                      variant="secondary"
                      block
                      onPress={() => router.push(`/activity/lead/${lead.id}`)}
                    />
                  </>
                ) : (
                  <Panel>
                    <Text variant="body" tone="muted">
                      No activity recorded yet. Log a call or a visit and it
                      will appear here.
                    </Text>
                  </Panel>
                )}
              </View>
            )}

            <Button
              label="Change Stage"
              block
              onPress={() => setStageOpen(true)}
              style={styles.cta}
            />
          </>
        )}
      </View>

      <ChangeStageSheet
        visible={stageOpen}
        onClose={() => setStageOpen(false)}
        lead={lead}
        onConfirm={changeStage}
      />
      <OpportunityActionsSheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onSelect={runAction}
        hidden={customer ? [] : ["view-customer"]}
      />
    </Screen>
  );
}

/** Mid-funnel is amber, won mint, lost red — the chips board's own ladder. */
function stageDotColor(stage: string): string {
  const tone = DEAL_STAGE_TONES[stage as keyof typeof DEAL_STAGE_TONES];
  switch (tone) {
    case "mint":
      return color.primary;
    case "amber":
      return color.amber;
    case "red":
      return color.red;
    case "steel":
      return color.steel;
    default:
      return color.muted2;
  }
}

function Metric({
  Icon,
  value,
  label,
}: {
  Icon: typeof Trophy;
  value: string;
  label: string;
}) {
  return (
    <Panel tone="mint" style={styles.metric}>
      <Icon size={17} color={color.primaryDark} strokeWidth={2} />
      <View style={styles.metricText}>
        <Text variant="cardTitle" numberOfLines={1}>
          {value}
        </Text>
        <Text variant="nano" tone="muted">
          {label}
        </Text>
      </View>
    </Panel>
  );
}

function RelatedRow({
  title,
  onPress,
  children,
}: {
  title: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.block}>
      <Text variant="caption" style={styles.blockTitle}>
        {title}
      </Text>
      <Card
        onPress={onPress}
        accessibilityLabel={title}
        style={styles.relatedCard}
      >
        <View style={styles.relatedRow}>
          {children}
          <ChevronRight size={16} color={color.muted2} strokeWidth={2} />
        </View>
      </Card>
    </View>
  );
}

function ContactDot({ Icon }: { Icon: typeof Phone }) {
  return (
    <View style={styles.contactDot}>
      <Icon size={14} color={color.primaryDark} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.xl },
  identity: {},
  identityRow: { flexDirection: "row", gap: space.md },
  identityTile: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { flex: 1, gap: 2 },
  identityChips: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  metric: {
    width: "47.5%",
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  metricText: { flex: 1, gap: 1 },
  stageRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  stageLabel: { width: 60 },
  stageSelect: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    height: 38,
    paddingHorizontal: space.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surfaceWhite,
  },
  stageDot: { width: 10, height: 10, borderRadius: radius.pill },
  stageValue: { flex: 1, fontFamily: font.semibold },
  tabs: { flexDirection: "row" },
  tab: { flex: 1, gap: space.sm },
  tabActive: { fontFamily: font.bold },
  tabRule: { height: 3, borderRadius: 2, backgroundColor: color.line },
  tabRuleActive: { backgroundColor: color.primary },
  section: { gap: space.xl },
  block: { gap: space.sm },
  blockTitle: { fontFamily: font.bold, color: color.ink },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  blockAction: { flexDirection: "row", alignItems: "center", gap: 2 },
  relatedCard: { padding: space.lg },
  relatedRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  relatedText: { flex: 1, gap: 2 },
  contactActions: { flexDirection: "row", gap: space.sm },
  contactDot: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  productCard: { padding: space.xs },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
  },
  productTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  activityRow: { flexDirection: "row", gap: space.md, padding: space.md },
  activityTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: color.lineSoft,
    marginHorizontal: space.md,
  },
  cta: { marginTop: space.sm },
});
