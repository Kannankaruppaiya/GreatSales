/**
 * 04 / 04A–04G — New Sales Lead.
 *
 * Six steps on one route: customer, opportunity, products, follow-up, review,
 * and the confirmation. The create-customer branch (04B) is a step inside the
 * flow rather than a separate screen, because sending someone away to another
 * route mid-form and bringing them back with the answer is exactly where a
 * half-typed lead gets lost.
 *
 * Probability (04C) is not a field. The schema carries none per deal, and the
 * app derives it from the stage everywhere else; offering it here would let a
 * person set a number that nothing stores and nothing reads back.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Clock, Plus, Trash2, User } from "lucide-react-native";
import type { DealStageValue, LeadProductRow } from "@greatsales/shared";

import {
  AppBar,
  Card,
  EmptyState,
  Input,
  KeyValueRow,
  Panel,
  RowDivider,
  Screen,
  Text,
} from "@/components/ui";
import {
  CustomerFields,
  DatePickerSheet,
  EMPTY_CUSTOMER_DRAFT,
  EntityPickerSheet,
  OptionSheet,
  PickerField,
  StepFooter,
  SuccessScreen,
  TimePickerSheet,
  WizardHeader,
  customerDraftToInput,
  formatSlot,
  isCustomerDraftReady,
  toDateKey,
  type CustomerDraft,
  type EntityOption,
} from "@/components/form";
import { useData } from "@/data/provider";
import { isMutable } from "@/data/source";
import { color, space } from "@/design/tokens";
import { longDate, money } from "@/lib/format";
import { DEAL_STAGE_LABELS, SELECTABLE_STAGES } from "@/lib/labels";

const STEPS = ["Customer", "Opportunity", "Products", "Follow-up", "Review"];

const FOLLOW_UP_PURPOSES = [
  "Site visit",
  "Pricing discussion",
  "Sample review",
  "Quotation follow-up",
  "Other",
] as const;

interface DraftProduct {
  productId: string;
  productName: string;
  principal: string;
  unit: string;
  qty: number;
  price: number;
}

export default function NewLeadScreen() {
  const params = useLocalSearchParams<{ customerId?: string }>();
  const router = useRouter();
  const source = useData();

  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<EntityOption | null>(null);
  /** 04B — the branch taken when the customer does not exist yet. */
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerDraft, setCustomerDraft] =
    useState<CustomerDraft>(EMPTY_CUSTOMER_DRAFT);

  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<DealStageValue>("NewEnquiries");
  const [expClose, setExpClose] = useState<string | null>(null);
  const [description, setDescription] = useState("");

  const [products, setProducts] = useState<DraftProduct[]>([]);

  const [followUpDate, setFollowUpDate] = useState<string | null>(null);
  const [followUpTime, setFollowUpTime] = useState<string | null>("10:00");
  const [followUpPurpose, setFollowUpPurpose] = useState<string | null>(null);
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [sheet, setSheet] = useState<
    | "customer"
    | "product"
    | "stage"
    | "close"
    | "fuDate"
    | "fuTime"
    | "fuPurpose"
    | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; value: number } | null>(
    null,
  );

  // Opened from a customer, the first step is already answered.
  useEffect(() => {
    if (!params.customerId) return;
    let live = true;
    source.getCustomer(params.customerId).then((row) => {
      if (!live || !row) return;
      setCustomer({ id: row.id, title: row.name, subtitle: row.area });
      setStep(1);
    });
    return () => {
      live = false;
    };
  }, [source, params.customerId]);

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

  const loadProducts = useCallback(
    async (search: string): Promise<EntityOption[]> => {
      const page = await source.listProducts({
        search: search || undefined,
        limit: 25,
      });
      return page.items.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: row.principal,
        meta: money(row.listPrice),
      }));
    },
    [source],
  );

  async function addProduct(option: EntityOption) {
    if (products.some((p) => p.productId === option.id)) return;
    const page = await source.listProducts({ search: option.title, limit: 20 });
    const product = page.items.find((p) => p.id === option.id);
    if (!product) return;

    const mappings = customer
      ? await source.listMappings({
          customerId: customer.id,
          productId: product.id,
          limit: 5,
        })
      : null;
    const agreed =
      mappings?.items.find((m) => m.productId === product.id)?.agreedPrice ??
      null;

    setProducts((current) => [
      ...current,
      {
        productId: product.id,
        productName: product.name,
        principal: product.principal,
        unit: product.unit,
        qty: 1,
        price: agreed ?? product.listPrice,
      },
    ]);
  }

  const totalValue = useMemo(
    () => products.reduce((sum, p) => sum + p.qty * p.price, 0),
    [products],
  );

  const today = useMemo(() => toDateKey(new Date()), []);

  const canAdvance =
    step === 0
      ? creatingCustomer
        ? isCustomerDraftReady(customerDraft)
        : customer != null
      : step === 1
        ? title.trim().length > 1
        : true;

  async function saveCustomerBranch(): Promise<EntityOption | null> {
    if (!isMutable(source)) return null;
    const row = await source.createCustomer(
      customerDraftToInput(customerDraft),
    );
    const option: EntityOption = {
      id: row.id,
      title: row.name,
      subtitle: row.area,
    };
    setCustomer(option);
    setCreatingCustomer(false);
    return option;
  }

  async function advance() {
    setError(null);
    // The new customer is saved when its step is left, so every later step —
    // and the mapping lookups on the products step — has a real id to use.
    if (step === 0 && creatingCustomer) {
      setSaving(true);
      try {
        await saveCustomerBranch();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "The customer could not be saved.",
        );
        return;
      } finally {
        setSaving(false);
      }
    }
    setStep((s) => s + 1);
  }

  async function submit() {
    if (!customer || !isMutable(source)) return;
    setSaving(true);
    setError(null);
    try {
      const lines: LeadProductRow[] = products.map((p, index) => ({
        id: `draft-${index}`,
        principalId: null,
        productId: p.productId,
        productName: p.productName,
        brand: p.principal,
        qty: p.qty,
        unit: p.unit,
        price: p.price,
        value: p.qty * p.price,
      }));

      const followUpAt =
        followUpDate && followUpTime
          ? new Date(`${followUpDate}T${followUpTime}:00`).toISOString()
          : null;

      const lead = await source.createLead({
        customerName: customer.title,
        stage,
        expClose,
        nextFollowUp: followUpAt,
        products: lines,
        totalValue,
        address: description.trim() || null,
      });

      // The follow-up is a record of its own, not a field on the lead, so it
      // is created alongside rather than implied by `nextFollowUp`.
      if (followUpAt && followUpPurpose) {
        await source.createFollowUp({
          leadId: lead.id,
          customerId: customer.id,
          customerName: customer.title,
          purpose: followUpPurpose,
          notes: followUpNotes.trim() || null,
          dueAt: followUpAt,
        });
      }

      setCreated({ id: lead.id, value: lead.totalValue });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The lead could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <SuccessScreen
        title="Lead created"
        reference={title.trim()}
        facts={[
          { label: "Customer", value: customer?.title ?? "" },
          { label: "Deal value", value: money(created.value) },
          { label: "Stage", value: DEAL_STAGE_LABELS[stage] },
          {
            label: "Expected closure",
            value: expClose ? longDate(expClose) : "Not set",
          },
          {
            label: "Next follow-up",
            value: followUpDate
              ? `${longDate(followUpDate)}, ${formatSlot(followUpTime ?? "10:00")}`
              : "None",
          },
        ]}
        actions={[
          {
            label: "View Opportunity",
            onPress: () => router.replace(`/lead/${created.id}`),
          },
          {
            label: "Add Another Lead",
            onPress: () => {
              setCreated(null);
              setStep(0);
              setCustomer(null);
              setTitle("");
              setProducts([]);
              setFollowUpDate(null);
              setFollowUpPurpose(null);
            },
          },
          {
            label: "Add Follow-up",
            onPress: () => router.replace(`/followup/new?leadId=${created.id}`),
            variant: "tertiary",
          },
          {
            label: "Back to Pipeline",
            onPress: () => router.replace("/(tabs)/pipeline"),
            variant: "tertiary",
          },
        ]}
      />
    );
  }

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="New Sales Lead" />

      <View style={styles.body}>
        <WizardHeader steps={STEPS} current={step} />

        {step === 0 ? (
          creatingCustomer ? (
            <View style={styles.section}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setCreatingCustomer(false)}
                style={styles.switchRow}
              >
                <Text variant="secondary" tone="primaryDark">
                  Pick an existing customer instead
                </Text>
              </Pressable>
              <CustomerFields
                value={customerDraft}
                onChange={setCustomerDraft}
              />
            </View>
          ) : (
            <View style={styles.section}>
              <PickerField
                label="Customer"
                value={customer?.title ?? null}
                placeholder="Search and choose"
                icon={<User size={16} color={color.muted} strokeWidth={2} />}
                onPress={() => setSheet("customer")}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setCreatingCustomer(true)}
                style={styles.switchRow}
              >
                <Plus size={16} color={color.primaryDark} strokeWidth={2.5} />
                <Text variant="secondary" tone="primaryDark">
                  This is a new customer
                </Text>
              </Pressable>
            </View>
          )
        ) : null}

        {step === 1 ? (
          <View style={styles.section}>
            <Input
              label="Opportunity name"
              value={title}
              onChangeText={setTitle}
              placeholder="What the deal is for"
              autoCapitalize="sentences"
            />
            <PickerField
              label="Stage"
              value={DEAL_STAGE_LABELS[stage]}
              placeholder="Pick a stage"
              onPress={() => setSheet("stage")}
            />
            <PickerField
              label="Expected closure"
              value={expClose ? longDate(expClose) : null}
              placeholder="Pick a date"
              icon={
                <CalendarDays size={16} color={color.muted} strokeWidth={2} />
              }
              onPress={() => setSheet("close")}
              hint="Optional"
            />
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="What was discussed"
              multiline
              numberOfLines={4}
              hint="Optional"
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.section}>
            {products.length === 0 ? (
              <EmptyState
                title="No products yet"
                body="Add what is being quoted so the deal carries a value. You can also add them later."
                actionLabel="Add a product"
                onAction={() => setSheet("product")}
              />
            ) : (
              <>
                {products.map((product) => (
                  <Card key={product.productId} style={styles.productCard}>
                    <View style={styles.productHead}>
                      <View style={styles.productText}>
                        <Text variant="cardTitle" numberOfLines={1}>
                          {product.productName}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {product.principal}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${product.productName}`}
                        hitSlop={10}
                        onPress={() =>
                          setProducts((c) =>
                            c.filter((p) => p.productId !== product.productId),
                          )
                        }
                      >
                        <Trash2 size={17} color={color.red} strokeWidth={2} />
                      </Pressable>
                    </View>

                    <View style={styles.pair}>
                      <Input
                        containerStyle={styles.pairItem}
                        label={`Quantity (${product.unit})`}
                        keyboardType="numeric"
                        value={String(product.qty)}
                        onChangeText={(t) => {
                          const qty = Number(t.replace(/[^0-9.]/g, "")) || 0;
                          setProducts((c) =>
                            c.map((p) =>
                              p.productId === product.productId
                                ? { ...p, qty }
                                : p,
                            ),
                          );
                        }}
                      />
                      <Input
                        containerStyle={styles.pairItem}
                        label="Unit price"
                        keyboardType="numeric"
                        value={String(product.price)}
                        onChangeText={(t) => {
                          const price = Number(t.replace(/[^0-9.]/g, "")) || 0;
                          setProducts((c) =>
                            c.map((p) =>
                              p.productId === product.productId
                                ? { ...p, price }
                                : p,
                            ),
                          );
                        }}
                      />
                    </View>

                    <Text variant="secondary" tone="muted">
                      Line value {money(product.qty * product.price)}
                    </Text>
                  </Card>
                ))}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add another product"
                  onPress={() => setSheet("product")}
                  style={styles.switchRow}
                >
                  <Plus size={16} color={color.primaryDark} strokeWidth={2.5} />
                  <Text variant="secondary" tone="primaryDark">
                    Add another product
                  </Text>
                </Pressable>

                <Panel tone="mint" style={styles.panel}>
                  <KeyValueRow label="Deal value" value={money(totalValue)} />
                </Panel>
              </>
            )}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.section}>
            <PickerField
              label="Follow-up"
              value={followUpPurpose}
              placeholder="What the next contact is for"
              onPress={() => setSheet("fuPurpose")}
              hint="Optional — leave it off if nothing is scheduled yet"
            />
            <View style={styles.pair}>
              <View style={styles.pairItem}>
                <PickerField
                  label="Date"
                  value={followUpDate ? longDate(followUpDate) : null}
                  placeholder="Pick a date"
                  icon={
                    <CalendarDays
                      size={16}
                      color={color.muted}
                      strokeWidth={2}
                    />
                  }
                  onPress={() => setSheet("fuDate")}
                />
              </View>
              <View style={styles.pairItem}>
                <PickerField
                  label="Time"
                  value={followUpTime ? formatSlot(followUpTime) : null}
                  placeholder="Pick a time"
                  icon={<Clock size={16} color={color.muted} strokeWidth={2} />}
                  onPress={() => setSheet("fuTime")}
                />
              </View>
            </View>
            <Input
              label="Notes"
              value={followUpNotes}
              onChangeText={setFollowUpNotes}
              placeholder="Anything to remember before the next contact"
              multiline
              numberOfLines={3}
              hint="Optional"
            />
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.section}>
            <Panel style={styles.panel}>
              <KeyValueRow label="Customer" value={customer?.title ?? ""} />
              <RowDivider />
              <KeyValueRow label="Opportunity" value={title.trim()} />
              <RowDivider />
              <KeyValueRow label="Stage" value={DEAL_STAGE_LABELS[stage]} />
              <RowDivider />
              <KeyValueRow label="Deal value" value={money(totalValue)} />
              <RowDivider />
              <KeyValueRow
                label="Expected closure"
                value={expClose ? longDate(expClose) : null}
                emptyText="Not set"
              />
              <RowDivider />
              <KeyValueRow
                label="Next follow-up"
                value={
                  followUpDate
                    ? `${longDate(followUpDate)}, ${formatSlot(followUpTime ?? "10:00")}`
                    : null
                }
                emptyText="None scheduled"
              />
            </Panel>

            {products.length > 0 ? (
              <Card flush>
                {products.map((product, index) => (
                  <View key={product.productId}>
                    {index > 0 ? <RowDivider /> : null}
                    <View style={styles.reviewLine}>
                      <View style={styles.productText}>
                        <Text variant="cardTitle" numberOfLines={1}>
                          {product.productName}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {product.qty} {product.unit} × {money(product.price)}
                        </Text>
                      </View>
                      <Text variant="cardTitle">
                        {money(product.qty * product.price)}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}

            {error ? (
              <Text variant="caption" tone="red">
                {error}
              </Text>
            ) : null}
          </View>
        ) : null}

        {error && step < 4 ? (
          <Text variant="caption" tone="red">
            {error}
          </Text>
        ) : null}

        <StepFooter
          onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
          onNext={step === STEPS.length - 1 ? submit : advance}
          nextLabel={step === STEPS.length - 1 ? "Create Lead" : "Continue"}
          nextDisabled={!canAdvance}
          busy={saving}
        />
      </View>

      <EntityPickerSheet
        visible={sheet === "customer"}
        onClose={() => setSheet(null)}
        title="Choose a customer"
        placeholder="Search by name, area or industry"
        load={loadCustomers}
        selectedId={customer?.id}
        onSelect={setCustomer}
        onCreate={() => setCreatingCustomer(true)}
        createLabel="Create a new customer"
      />
      <EntityPickerSheet
        visible={sheet === "product"}
        onClose={() => setSheet(null)}
        title="Add a product"
        placeholder="Search products"
        load={loadProducts}
        onSelect={addProduct}
      />
      <OptionSheet
        visible={sheet === "stage"}
        onClose={() => setSheet(null)}
        title="Pipeline stage"
        options={SELECTABLE_STAGES.map((value) => ({
          value,
          label: DEAL_STAGE_LABELS[value],
        }))}
        value={stage}
        onChange={setStage}
      />
      <DatePickerSheet
        visible={sheet === "close"}
        onClose={() => setSheet(null)}
        value={expClose}
        onChange={setExpClose}
        min={today}
        title="Expected closure"
      />
      <DatePickerSheet
        visible={sheet === "fuDate"}
        onClose={() => setSheet(null)}
        value={followUpDate}
        onChange={setFollowUpDate}
        min={today}
        title="Follow-up date"
      />
      <TimePickerSheet
        visible={sheet === "fuTime"}
        onClose={() => setSheet(null)}
        value={followUpTime}
        onChange={setFollowUpTime}
        title="Follow-up time"
      />
      <OptionSheet
        visible={sheet === "fuPurpose"}
        onClose={() => setSheet(null)}
        title="Follow-up for"
        options={FOLLOW_UP_PURPOSES.map((p) => ({ value: p, label: p }))}
        value={followUpPurpose as (typeof FOLLOW_UP_PURPOSES)[number] | null}
        onChange={(next) => setFollowUpPurpose(next)}
        clearLabel="No follow-up yet"
        onClear={() => setFollowUpPurpose(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter },
  section: { gap: space.lg },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    minHeight: 44,
  },
  productCard: { gap: space.md },
  productHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  productText: { flex: 1, gap: 2 },
  pair: { flexDirection: "row", gap: space.md },
  pairItem: { flex: 1 },
  panel: { paddingVertical: space.xs },
  reviewLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
  },
});
