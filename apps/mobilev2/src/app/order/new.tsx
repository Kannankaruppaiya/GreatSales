/**
 * 03H / 08D–08J — Create Sales Order.
 *
 * One route with six steps rather than six routes, so a half-built order
 * survives a back press and the review step can still reach every answer. It
 * serves three entry points: the + launcher, an opportunity (03H, which
 * pre-fills the customer and its products) and a projection (07J).
 *
 * Prices default to the agreed price on the salesperson's mapping for that
 * customer and product, and fall back to the product's list price when there
 * is no mapping. The row says which of the two it used, because a price the
 * customer has not agreed to is worth flagging before the order goes in.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Minus, Plus, Trash2, User } from "lucide-react-native";
import type { PaymentTermsValue } from "@greatsales/shared";

import {
  AppBar,
  Card,
  Chip,
  EmptyState,
  Input,
  KeyValueRow,
  Panel,
  RowDivider,
  Screen,
  Text,
} from "@/components/ui";
import {
  DatePickerSheet,
  EntityPickerSheet,
  OptionSheet,
  PickerField,
  StepFooter,
  SuccessScreen,
  WizardHeader,
  toDateKey,
  type EntityOption,
} from "@/components/form";
import { useData } from "@/data/provider";
import { isMutable } from "@/data/source";
import { color, radius, space } from "@/design/tokens";
import { longDate, money, moneyShort } from "@/lib/format";
import { PAYMENT_TERMS_LABELS } from "@/lib/labels";

const STEPS = ["Customer", "Products", "Pricing", "Delivery", "Payment", "Review"];

/** The tax the synthetic orders carry; the API returns its own on the order. */
const DEFAULT_TAX_RATE = 0.18;

interface Line {
  productId: string;
  productName: string;
  principal: string;
  unit: string;
  qty: number;
  price: number;
  /** Where the price came from, so the review can say so. */
  priceSource: "mapping" | "list";
}

export default function NewOrderScreen() {
  const params = useLocalSearchParams<{
    leadId?: string;
    customerId?: string;
    productId?: string;
  }>();
  const router = useRouter();
  const source = useData();

  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<EntityOption | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [deliveryAt, setDeliveryAt] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [terms, setTerms] = useState<PaymentTermsValue | null>(null);
  const [notes, setNotes] = useState("");

  const [sheet, setSheet] = useState<"customer" | "product" | "date" | "terms" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ soNumber: string; id: string; total: number } | null>(
    null,
  );

  // Coming from an opportunity or a projection, the customer and often the
  // products are already known; the flow opens on the products step.
  useEffect(() => {
    let live = true;
    (async () => {
      if (params.customerId) {
        const row = await source.getCustomer(params.customerId);
        if (live && row) {
          setCustomer({ id: row.id, title: row.name, subtitle: row.area });
          setAddress(row.area ?? "");
          setTerms(row.paymentTerms ?? null);
          setStep(1);
        }
        return;
      }
      if (!params.leadId) return;
      const lead = await source.getLead(params.leadId);
      if (!live || !lead) return;
      const page = await source.listCustomers({ search: lead.customerName, limit: 10 });
      const row = page.items.find((c) => c.name === lead.customerName) ?? page.items[0];
      if (!row) return;
      setCustomer({ id: row.id, title: row.name, subtitle: row.area });
      setAddress(row.area ?? "");
      setTerms(row.paymentTerms ?? null);
      setStep(1);
    })();
    return () => {
      live = false;
    };
  }, [source, params.customerId, params.leadId]);

  const loadCustomers = useCallback(
    async (search: string): Promise<EntityOption[]> => {
      const page = await source.listCustomers({ search: search || undefined, limit: 25 });
      return page.items.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: row.area ?? row.industryName,
        meta: row.outstanding > 0 ? `${moneyShort(row.outstanding)} due` : null,
      }));
    },
    [source],
  );

  const loadProducts = useCallback(
    async (search: string): Promise<EntityOption[]> => {
      const page = await source.listProducts({ search: search || undefined, limit: 25 });
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
    if (lines.some((l) => l.productId === option.id)) return;
    const products = await source.listProducts({ search: option.title, limit: 20 });
    const product = products.items.find((p) => p.id === option.id);
    if (!product) return;

    // An agreed price on the salesperson's own mapping wins over the list price.
    const mappings = customer
      ? await source.listMappings({ customerId: customer.id, productId: product.id, limit: 5 })
      : null;
    const agreed = mappings?.items.find((m) => m.productId === product.id)?.agreedPrice ?? null;

    setLines((current) => [
      ...current,
      {
        productId: product.id,
        productName: product.name,
        principal: product.principal,
        unit: product.unit,
        qty: 1,
        price: agreed ?? product.listPrice,
        priceSource: agreed != null ? "mapping" : "list",
      },
    ]);
  }

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.qty * l.price, 0),
    [lines],
  );
  const tax = Math.round(subtotal * DEFAULT_TAX_RATE);
  const total = subtotal + tax;

  const canAdvance =
    step === 0 ? customer != null : step === 1 ? lines.length > 0 : step === 2 ? subtotal > 0 : true;

  async function submit() {
    if (!customer || lines.length === 0 || !isMutable(source)) return;
    setSaving(true);
    setError(null);
    try {
      const order = await source.createOrder({
        customerId: customer.id,
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price })),
        expectedDeliveryAt: deliveryAt ? new Date(`${deliveryAt}T10:00:00`).toISOString() : null,
        deliveryAddress: address.trim() || null,
        paymentTerms: terms ?? undefined,
      });
      setCreated({ soNumber: order.soNumber, id: order.id, total: order.total });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The order could not be created.");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <SuccessScreen
        title="Sales order created"
        reference={created.soNumber}
        facts={[
          { label: "Customer", value: customer?.title ?? "" },
          { label: "Products", value: String(lines.length) },
          { label: "Total", value: money(created.total) },
          {
            label: "Expected delivery",
            value: deliveryAt ? longDate(deliveryAt) : "Not set",
          },
        ]}
        actions={[
          { label: "View Order", onPress: () => router.replace(`/order/${created.id}`) },
          {
            label: "Create Another Order",
            onPress: () => {
              setCreated(null);
              setLines([]);
              setStep(0);
              setCustomer(null);
            },
          },
          { label: "Back to Orders", onPress: () => router.replace("/orders"), variant: "tertiary" },
        ]}
      />
    );
  }

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="New Sales Order" />

      <View style={styles.body}>
        <WizardHeader steps={STEPS} current={step} />

        {step === 0 ? (
          <PickerField
            label="Customer"
            value={customer?.title ?? null}
            placeholder="Choose a customer"
            icon={<User size={16} color={color.muted} strokeWidth={2} />}
            onPress={() => setSheet("customer")}
          />
        ) : null}

        {step === 1 ? (
          <View style={styles.section}>
            {lines.length === 0 ? (
              <EmptyState
                title="No products yet"
                body="Add the products this order is for, then set the quantities."
                actionLabel="Add a product"
                onAction={() => setSheet("product")}
              />
            ) : (
              <>
                {lines.map((line) => (
                  <Card key={line.productId} style={styles.lineCard}>
                    <View style={styles.lineHead}>
                      <View style={styles.lineText}>
                        <Text variant="cardTitle" numberOfLines={1}>
                          {line.productName}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {line.principal}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${line.productName}`}
                        hitSlop={10}
                        onPress={() =>
                          setLines((c) => c.filter((l) => l.productId !== line.productId))
                        }
                      >
                        <Trash2 size={17} color={color.red} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </Card>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add another product"
                  onPress={() => setSheet("product")}
                  style={styles.addRow}
                >
                  <Plus size={17} color={color.primaryDark} strokeWidth={2.5} />
                  <Text variant="body" tone="primaryDark">
                    Add another product
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.section}>
            {lines.map((line) => (
              <Card key={line.productId} style={styles.lineCard}>
                <View style={styles.lineText}>
                  <Text variant="cardTitle" numberOfLines={1}>
                    {line.productName}
                  </Text>
                  <Chip
                    label={line.priceSource === "mapping" ? "Agreed price" : "List price"}
                    tone={line.priceSource === "mapping" ? "mint" : "neutral"}
                  />
                </View>

                <View style={styles.qtyRow}>
                  <Text variant="caption" tone="muted" style={styles.qtyLabel}>
                    Quantity ({line.unit})
                  </Text>
                  <Stepper
                    value={line.qty}
                    onChange={(qty) =>
                      setLines((c) =>
                        c.map((l) => (l.productId === line.productId ? { ...l, qty } : l)),
                      )
                    }
                  />
                </View>

                <Input
                  label="Unit price"
                  keyboardType="numeric"
                  value={String(line.price)}
                  onChangeText={(text) => {
                    const price = Number(text.replace(/[^0-9.]/g, "")) || 0;
                    setLines((c) =>
                      c.map((l) =>
                        l.productId === line.productId
                          ? { ...l, price, priceSource: "list" }
                          : l,
                      ),
                    );
                  }}
                />

                <Text variant="secondary" tone="muted">
                  Line total {money(line.qty * line.price)}
                </Text>
              </Card>
            ))}

            <Totals subtotal={subtotal} tax={tax} total={total} />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.section}>
            <PickerField
              label="Expected delivery"
              value={deliveryAt ? longDate(deliveryAt) : null}
              placeholder="Pick a date"
              icon={<CalendarDays size={16} color={color.muted} strokeWidth={2} />}
              onPress={() => setSheet("date")}
              hint="Optional"
            />
            <Input
              label="Delivery address"
              value={address}
              onChangeText={setAddress}
              placeholder="Where this order should go"
              multiline
              numberOfLines={3}
            />
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.section}>
            <PickerField
              label="Payment terms"
              value={terms ? PAYMENT_TERMS_LABELS[terms] : null}
              placeholder="Choose payment terms"
              onPress={() => setSheet("terms")}
              hint="Defaults to the customer's own terms"
            />
            <Input
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything the warehouse or the customer should know"
              multiline
              numberOfLines={3}
              hint="Optional"
            />
          </View>
        ) : null}

        {step === 5 ? (
          <View style={styles.section}>
            <Panel style={styles.review}>
              <KeyValueRow label="Customer" value={customer?.title ?? ""} />
              <RowDivider />
              <KeyValueRow
                label="Delivery"
                value={deliveryAt ? longDate(deliveryAt) : "Not set"}
              />
              <RowDivider />
              <KeyValueRow
                label="Payment terms"
                value={terms ? PAYMENT_TERMS_LABELS[terms] : "Not set"}
              />
              {address.trim() ? (
                <>
                  <RowDivider />
                  <KeyValueRow label="Address" value={address.trim()} />
                </>
              ) : null}
              {notes.trim() ? (
                <>
                  <RowDivider />
                  <KeyValueRow label="Notes" value={notes.trim()} />
                </>
              ) : null}
            </Panel>

            <Card flush style={styles.reviewLines}>
              {lines.map((line, index) => (
                <View key={line.productId}>
                  {index > 0 ? <RowDivider /> : null}
                  <View style={styles.reviewLine}>
                    <View style={styles.lineText}>
                      <Text variant="cardTitle" numberOfLines={1}>
                        {line.productName}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {line.qty} {line.unit} × {money(line.price)}
                        {line.priceSource === "list" ? " · list price" : ""}
                      </Text>
                    </View>
                    <Text variant="cardTitle">{money(line.qty * line.price)}</Text>
                  </View>
                </View>
              ))}
            </Card>

            <Totals subtotal={subtotal} tax={tax} total={total} />

            {error ? (
              <Text variant="caption" tone="red">
                {error}
              </Text>
            ) : null}
          </View>
        ) : null}

        <StepFooter
          onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
          onNext={step === STEPS.length - 1 ? submit : () => setStep((s) => s + 1)}
          nextLabel={step === STEPS.length - 1 ? "Create Order" : "Continue"}
          nextDisabled={!canAdvance}
          busy={saving}
        />
      </View>

      <EntityPickerSheet
        visible={sheet === "customer"}
        onClose={() => setSheet(null)}
        title="Choose a customer"
        placeholder="Search customers"
        load={loadCustomers}
        selectedId={customer?.id}
        onSelect={(option) => {
          setCustomer(option);
          // A different customer means different agreed prices.
          setLines([]);
        }}
      />
      <EntityPickerSheet
        visible={sheet === "product"}
        onClose={() => setSheet(null)}
        title="Add a product"
        placeholder="Search products"
        load={loadProducts}
        onSelect={addProduct}
      />
      <DatePickerSheet
        visible={sheet === "date"}
        onClose={() => setSheet(null)}
        value={deliveryAt}
        onChange={setDeliveryAt}
        min={toDateKey(new Date())}
        title="Expected delivery"
      />
      <OptionSheet
        visible={sheet === "terms"}
        onClose={() => setSheet(null)}
        title="Payment terms"
        options={(Object.keys(PAYMENT_TERMS_LABELS) as PaymentTermsValue[]).map((value) => ({
          value,
          label: PAYMENT_TERMS_LABELS[value],
        }))}
        value={terms}
        onChange={setTerms}
      />
    </Screen>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        hitSlop={8}
        disabled={value <= 1}
        onPress={() => onChange(Math.max(1, value - 1))}
        style={styles.stepperButton}
      >
        <Minus size={15} color={value <= 1 ? color.muted2 : color.ink} strokeWidth={2.5} />
      </Pressable>
      <Text variant="cardTitle" align="center" style={styles.stepperValue}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        hitSlop={8}
        onPress={() => onChange(value + 1)}
        style={styles.stepperButton}
      >
        <Plus size={15} color={color.ink} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function Totals({ subtotal, tax, total }: { subtotal: number; tax: number; total: number }) {
  return (
    <Panel tone="mint" style={styles.totals}>
      <KeyValueRow label="Subtotal" value={money(subtotal)} />
      <KeyValueRow
        label={`Tax (${Math.round(DEFAULT_TAX_RATE * 100)}%)`}
        value={money(tax)}
      />
      <RowDivider />
      <KeyValueRow label="Total" value={money(total)} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter },
  section: { gap: space.lg },
  lineCard: { gap: space.md },
  lineHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  lineText: { flex: 1, gap: space.xs, alignItems: "flex-start" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  qtyLabel: { flex: 1 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.input,
    backgroundColor: color.surfaceWhite,
  },
  stepperButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  stepperValue: { minWidth: 34 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    minHeight: 48,
  },
  totals: { paddingVertical: space.xs },
  review: { paddingVertical: space.xs },
  reviewLines: {},
  reviewLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
  },
});
