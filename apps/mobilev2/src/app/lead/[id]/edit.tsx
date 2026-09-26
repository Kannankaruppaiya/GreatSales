/**
 * Edit an opportunity — the "Edit" action on the 03I sheet.
 *
 * Only the fields `updateLead` can actually write: the stage, the expected
 * closure and the products with their quantities and prices. The customer is
 * shown and not editable, because moving a deal to another customer is a
 * different record rather than an edit of this one.
 *
 * Products are edited here rather than on 03F. That screen is about whether a
 * quoted price has a mapping behind it; this one is where the numbers change.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Plus, Trash2 } from "lucide-react-native";
import type { DealStageValue } from "@greatsales/shared";

import {
  AppBar,
  Button,
  Card,
  EmptyState,
  Input,
  KeyValueRow,
  Panel,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import {
  DatePickerSheet,
  EntityPickerSheet,
  OptionSheet,
  PickerField,
  type EntityOption,
} from "@/components/form";
import { useData } from "@/data/provider";
import { describeError } from "@/data/http";
import { color, space } from "@/design/tokens";
import { longDate, money } from "@/lib/format";
import { DEAL_STAGE_LABELS, SELECTABLE_STAGES } from "@/lib/labels";
import { useAsync } from "@/lib/useAsync";
import { leave } from "@/lib/nav";

interface EditableProduct {
  id: string;
  productId: string | null;
  productName: string;
  principalId: string | null;
  brand: string | null;
  unit: string | null;
  qty: number;
  price: number;
}

export default function EditOpportunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const source = useData();

  const state = useAsync(
    () => (id ? source.getLead(id) : Promise.resolve(null)),
    [source, id],
  );
  const lead = state.data ?? null;

  const [stage, setStage] = useState<DealStageValue>("NewEnquiries");
  const [expClose, setExpClose] = useState<string | null>(null);
  const [products, setProducts] = useState<EditableProduct[]>([]);
  const [sheet, setSheet] = useState<"stage" | "close" | "product" | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seeded once the row arrives, so a refresh does not discard edits in flight.
  useEffect(() => {
    if (!lead) return;
    setStage(lead.stage);
    setExpClose(lead.expClose ? lead.expClose.slice(0, 10) : null);
    setProducts(
      lead.products.map((p) => ({
        id: p.id,
        productId: p.productId,
        productName: p.productName,
        principalId: p.principalId,
        brand: p.brand,
        unit: p.unit,
        qty: p.qty ?? 0,
        price: p.price ?? 0,
      })),
    );
  }, [lead?.id]);

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
    setProducts((current) => [
      ...current,
      {
        id: `new-${product.id}`,
        productId: product.id,
        productName: product.name,
        principalId: product.principalId,
        brand: product.principal,
        unit: product.unit,
        qty: 1,
        // No catalogue price: start at zero for the salesperson to type in,
        // rather than inventing one.
        price: product.listPrice ?? 0,
      },
    ]);
  }

  const totalValue = products.reduce((sum, p) => sum + p.qty * p.price, 0);

  async function save() {
    if (!lead) return;
    setSaving(true);
    setError(null);
    try {
      await source.updateLead(lead.id, {
        stage,
        expClose,
        products: products.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          principalId: p.principalId,
          qty: p.qty,
          unit: p.unit,
          price: p.price,
        })),
      });
      leave(router, "/(tabs)/pipeline");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="Edit Opportunity" />

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
            <Panel style={styles.panel}>
              <KeyValueRow label="Customer" value={lead.customerName} />
            </Panel>

            <PickerField
              label="Stage"
              value={DEAL_STAGE_LABELS[stage]}
              placeholder="Pick a stage"
              onPress={() => setSheet("stage")}
            />

            <PickerField
              label="Expected closure"
              value={expClose ? longDate(expClose) : null}
              placeholder="Not set"
              icon={
                <CalendarDays size={16} color={color.muted} strokeWidth={2} />
              }
              onPress={() => setSheet("close")}
            />

            <Text variant="section" style={styles.heading}>
              Products
            </Text>

            {products.map((product) => (
              <Card key={product.id} style={styles.productCard}>
                <View style={styles.productHead}>
                  <View style={styles.productText}>
                    <Text variant="cardTitle" numberOfLines={1}>
                      {product.productName}
                    </Text>
                    {product.brand ? (
                      <Text variant="caption" tone="muted">
                        {product.brand}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${product.productName}`}
                    hitSlop={10}
                    onPress={() =>
                      setProducts((c) => c.filter((p) => p.id !== product.id))
                    }
                  >
                    <Trash2 size={17} color={color.red} strokeWidth={2} />
                  </Pressable>
                </View>

                <View style={styles.pair}>
                  <Input
                    containerStyle={styles.pairItem}
                    label={
                      product.unit ? `Quantity (${product.unit})` : "Quantity"
                    }
                    keyboardType="numeric"
                    value={String(product.qty)}
                    onChangeText={(t) => {
                      const qty = Number(t.replace(/[^0-9.]/g, "")) || 0;
                      setProducts((c) =>
                        c.map((p) => (p.id === product.id ? { ...p, qty } : p)),
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
                          p.id === product.id ? { ...p, price } : p,
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
              accessibilityLabel="Add a product"
              onPress={() => setSheet("product")}
              style={styles.addRow}
            >
              <Plus size={16} color={color.primaryDark} strokeWidth={2.5} />
              <Text variant="secondary" tone="primaryDark">
                Add a product
              </Text>
            </Pressable>

            <Panel tone="mint" style={styles.panel}>
              <KeyValueRow label="Deal value" value={money(totalValue)} />
            </Panel>

            {error ? (
              <Text variant="caption" tone="red">
                {error}
              </Text>
            ) : null}

            <Button
              label="Save Changes"
              block
              loading={saving}
              onPress={save}
            />
          </>
        )}
      </View>

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
        title="Expected closure"
      />
      <EntityPickerSheet
        visible={sheet === "product"}
        onClose={() => setSheet(null)}
        title="Add a product"
        placeholder="Search products"
        load={loadProducts}
        onSelect={addProduct}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
  panel: { paddingVertical: space.xs },
  heading: { marginTop: space.sm },
  productCard: { gap: space.md },
  productHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  productText: { flex: 1, gap: 2 },
  pair: { flexDirection: "row", gap: space.md },
  pairItem: { flex: 1 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    minHeight: 44,
  },
});
