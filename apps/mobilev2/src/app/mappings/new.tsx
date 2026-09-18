/**
 * 06B–06G — Create a mapping.
 *
 * Customer, product, price, review. The principal is not a step of its own
 * (06D): it belongs to the product, so choosing a product decides it, and a
 * separate picker would only let the two disagree.
 *
 * The price step shows the list price beside the field so the agreed figure is
 * entered against something rather than into a blank.
 */
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { IndianRupee, Package, User } from "lucide-react-native";

import {
  AppBar,
  Input,
  KeyValueRow,
  Panel,
  RowDivider,
  Screen,
  Text,
} from "@/components/ui";
import {
  EntityPickerSheet,
  PickerField,
  StepFooter,
  SuccessScreen,
  WizardHeader,
  type EntityOption,
} from "@/components/form";
import { useData } from "@/data/provider";
import { isMutable } from "@/data/source";
import { color, space } from "@/design/tokens";
import { money } from "@/lib/format";

const STEPS = ["Customer", "Product", "Price", "Review"];

export default function NewMappingScreen() {
  const params = useLocalSearchParams<{ customerId?: string; productId?: string }>();
  const router = useRouter();
  const source = useData();

  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<EntityOption | null>(null);
  const [product, setProduct] = useState<EntityOption | null>(null);
  const [listPrice, setListPrice] = useState<number | null>(null);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [agreed, setAgreed] = useState("");

  const [sheet, setSheet] = useState<"customer" | "product" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  // 03F links here with both already decided, to fix a product it found
  // unmapped; the flow then opens on the price step.
  useEffect(() => {
    let live = true;
    (async () => {
      const customerRow = params.customerId ? await source.getCustomer(params.customerId) : null;
      if (live && customerRow) {
        setCustomer({ id: customerRow.id, title: customerRow.name, subtitle: customerRow.area });
      }
      if (!params.productId) {
        if (customerRow) setStep(1);
        return;
      }
      const products = await source.listProducts({ limit: 200 });
      const productRow = products.items.find((p) => p.id === params.productId);
      if (live && productRow) {
        setProduct({ id: productRow.id, title: productRow.name, subtitle: productRow.principal });
        setListPrice(productRow.listPrice);
        setPrincipal(productRow.principal);
        if (customerRow) setStep(2);
      }
    })();
    return () => {
      live = false;
    };
  }, [source, params.customerId, params.productId]);

  const loadCustomers = useCallback(
    async (search: string): Promise<EntityOption[]> => {
      const page = await source.listCustomers({ search: search || undefined, limit: 25 });
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

  async function pickProduct(option: EntityOption) {
    setProduct(option);
    const page = await source.listProducts({ search: option.title, limit: 20 });
    const row = page.items.find((p) => p.id === option.id);
    setListPrice(row?.listPrice ?? null);
    setPrincipal(row?.principal ?? option.subtitle ?? null);
    // A blank agreed price is a real answer: it means "charge list price".
    setAgreed("");
  }

  const agreedValue = agreed.trim() === "" ? null : Number(agreed.replace(/[^0-9.]/g, ""));
  const canAdvance = step === 0 ? customer != null : step === 1 ? product != null : true;

  async function submit() {
    if (!customer || !product || !isMutable(source)) return;
    setSaving(true);
    setError(null);
    try {
      const mapping = await source.createMapping({
        customerId: customer.id,
        productId: product.id,
        agreedPrice: agreedValue,
      });
      setCreated(mapping.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The mapping could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <SuccessScreen
        title="Mapping created"
        reference={`${customer?.title} · ${product?.title}`}
        facts={[
          { label: "Principal", value: principal ?? "Not set" },
          { label: "List price", value: listPrice != null ? money(listPrice) : "—" },
          {
            label: "Agreed price",
            value: agreedValue != null ? money(agreedValue) : "List price applies",
          },
        ]}
        actions={[
          { label: "View Mapping", onPress: () => router.replace(`/mapping/${created}`) },
          {
            label: "Add Another Mapping",
            onPress: () => {
              setCreated(null);
              setStep(0);
              setCustomer(null);
              setProduct(null);
              setAgreed("");
            },
          },
          {
            label: "Back to Mappings",
            onPress: () => router.replace("/mappings"),
            variant: "tertiary",
          },
        ]}
      />
    );
  }

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="New Mapping" />

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
            <PickerField
              label="Product"
              value={product?.title ?? null}
              placeholder="Choose a product"
              icon={<Package size={16} color={color.muted} strokeWidth={2} />}
              onPress={() => setSheet("product")}
            />
            {principal ? (
              <Panel style={styles.panel}>
                <KeyValueRow label="Principal" value={principal} />
                <RowDivider />
                <KeyValueRow
                  label="List price"
                  value={listPrice != null ? money(listPrice) : "—"}
                />
              </Panel>
            ) : null}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.section}>
            <Panel tone="mint" style={styles.panel}>
              <KeyValueRow label="List price" value={listPrice != null ? money(listPrice) : "—"} />
            </Panel>
            <Input
              label="Agreed price"
              value={agreed}
              onChangeText={setAgreed}
              keyboardType="numeric"
              placeholder={listPrice != null ? String(listPrice) : "Price per unit"}
              icon={<IndianRupee size={15} color={color.muted} strokeWidth={2} />}
              hint="Leave it empty to charge the list price"
            />
            {agreedValue != null && listPrice != null && agreedValue !== listPrice ? (
              <Text variant="caption" tone={agreedValue < listPrice ? "amber" : "primaryDark"}>
                {agreedValue < listPrice
                  ? `${money(listPrice - agreedValue)} below list price.`
                  : `${money(agreedValue - listPrice)} above list price.`}
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.section}>
            <Panel style={styles.panel}>
              <KeyValueRow label="Customer" value={customer?.title ?? ""} />
              <RowDivider />
              <KeyValueRow label="Product" value={product?.title ?? ""} />
              <RowDivider />
              <KeyValueRow label="Principal" value={principal} emptyText="Not set" />
              <RowDivider />
              <KeyValueRow label="List price" value={listPrice != null ? money(listPrice) : "—"} />
              <RowDivider />
              <KeyValueRow
                label="Agreed price"
                value={agreedValue != null ? money(agreedValue) : null}
                emptyText="List price applies"
              />
            </Panel>

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
          nextLabel={step === STEPS.length - 1 ? "Create Mapping" : "Continue"}
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
        onSelect={setCustomer}
      />
      <EntityPickerSheet
        visible={sheet === "product"}
        onClose={() => setSheet(null)}
        title="Choose a product"
        placeholder="Search products"
        load={loadProducts}
        selectedId={product?.id}
        onSelect={pickProduct}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter },
  section: { gap: space.lg },
  panel: { paddingVertical: space.xs },
});
