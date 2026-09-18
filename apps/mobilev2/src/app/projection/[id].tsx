/**
 * 07C–07L — Projection detail.
 *
 * Everything the spec lists as its own screen — edit (07D), next follow-up
 * (07E), target date (07F), status (07G), remarks (07H), follow-up log (07I),
 * convert to order (07J), delete (07K) — is an action on this one row, so it
 * lives here rather than behind eight routes each showing the same row again.
 *
 * 07L is the whole screen's second state. When the period is locked every
 * control disappears and the banner says why, and the data source refuses the
 * write as well, so a screen left open across a month-end close cannot save
 * through.
 */
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Lock, ShoppingCart, Trash2 } from "lucide-react-native";

import {
  AppBar,
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
import {
  DatePickerSheet,
  OptionSheet,
  PickerField,
  toDateKey,
} from "@/components/form";
import { useData } from "@/data/provider";
import { isMutable } from "@/data/source";
import { color, space } from "@/design/tokens";
import { longDate, money, percent, quantity } from "@/lib/format";
import {
  PROJECTION_STATUSES,
  PROJECTION_STATUS_LABELS,
  PROJECTION_STATUS_TONES,
  periodLabel,
  type ProjectionStatus,
} from "@/lib/projection-labels";
import { useAsync } from "@/lib/useAsync";

export default function ProjectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const source = useData();

  const state = useAsync(async () => {
    const projection = id ? await source.getProjection(id) : null;
    if (!projection) return { projection: null, followUps: [] };
    const followUps = await source.listFollowUps({
      customerId: projection.customerId,
      limit: 20,
    });
    return { projection, followUps: followUps.items };
  }, [source, id]);

  const projection = state.data?.projection ?? null;
  const locked = projection?.locked ?? false;

  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [remarks, setRemarks] = useState("");
  const [sheet, setSheet] = useState<"status" | "followUp" | "target" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Seeded when the row arrives, so a reload does not wipe what is being typed.
  useEffect(() => {
    if (!projection) return;
    setQty(String(projection.projectedQty));
    setPrice(String(projection.price));
    setRemarks(projection.remarks ?? "");
  }, [projection?.id]);

  /** Every edit on this screen is a partial update of the same row. */
  async function patch(input: Record<string, unknown>) {
    if (!projection || !isMutable(source) || locked) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await source.updateProjection(projection.id, input);
      setSaved(true);
      state.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The projection could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const qtyValue = Number(qty.replace(/[^0-9.]/g, "")) || 0;
  const priceValue = Number(price.replace(/[^0-9.]/g, "")) || 0;
  const numbersChanged =
    projection != null &&
    (qtyValue !== projection.projectedQty || priceValue !== projection.price);
  const remarksChanged = projection != null && remarks.trim() !== (projection.remarks ?? "");

  function confirmDelete() {
    if (!projection) return;
    Alert.alert(
      "Delete this projection?",
      `${projection.customerName} · ${projection.productName} for ${periodLabel(projection.period)} will be removed from the month. This cannot be undone.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!isMutable(source)) return;
            try {
              await source.deleteProjection(projection.id);
              router.back();
            } catch (e) {
              setError(e instanceof Error ? e.message : "It could not be deleted.");
            }
          },
        },
      ],
    );
  }

  const achievement =
    projection && projection.projectedValue > 0
      ? (projection.achievedValue / projection.projectedValue) * 100
      : 0;

  return (
    <Screen tabBarSpacing bleed onRefresh={state.reload} refreshing={state.refreshing}>
      <AppBar title="Projection" />

      <View style={styles.body}>
        {state.loading ? (
          <SkeletonList rows={4} />
        ) : !projection ? (
          <EmptyState
            title="Projection not found"
            body="It may have been deleted since this screen was opened."
            actionLabel="Back to Projections"
            onAction={() => router.replace("/projections")}
          />
        ) : (
          <>
            <Card>
              <View style={styles.headRow}>
                <View style={styles.headText}>
                  <Text variant="section" numberOfLines={2}>
                    {projection.productName}
                  </Text>
                  <Text variant="body" tone="muted" numberOfLines={1}>
                    {projection.customerName}
                  </Text>
                </View>
                <Chip
                  label={PROJECTION_STATUS_LABELS[projection.status]}
                  tone={PROJECTION_STATUS_TONES[projection.status]}
                />
              </View>
              <Text variant="caption" tone="muted">
                {periodLabel(projection.period)} · {projection.principal}
              </Text>
            </Card>

            {locked ? (
              <Panel tone="amber">
                <View style={styles.lockRow}>
                  <Lock size={17} color={color.amber} strokeWidth={2} />
                  <Text variant="caption" tone="amber" style={styles.lockText}>
                    {periodLabel(projection.period)} is closed. Its figures are kept as a record of
                    what was committed, so nothing here can be changed or deleted. Open the current
                    month to plan ahead.
                  </Text>
                </View>
              </Panel>
            ) : null}

            <Panel style={styles.panel}>
              <KeyValueRow
                label="Projected"
                value={`${quantity(projection.projectedQty)} · ${money(projection.projectedValue)}`}
              />
              <RowDivider />
              <KeyValueRow
                label="Achieved"
                value={`${quantity(projection.achievedQty)} · ${money(projection.achievedValue)}`}
              />
              <RowDivider />
              <KeyValueRow label="Achievement" value={percent(achievement)} />
              <RowDivider />
              <KeyValueRow label="Unit price" value={money(projection.price)} />
              <RowDivider />
              <KeyValueRow label="Probability" value={percent(projection.probability)} />
            </Panel>

            {!locked ? (
              <>
                <Text variant="section">Update</Text>

                <View style={styles.pair}>
                  <Input
                    containerStyle={styles.pairItem}
                    label="Projected quantity"
                    keyboardType="numeric"
                    value={qty}
                    onChangeText={setQty}
                  />
                  <Input
                    containerStyle={styles.pairItem}
                    label="Unit price"
                    keyboardType="numeric"
                    value={price}
                    onChangeText={setPrice}
                  />
                </View>

                <Text variant="caption" tone="muted">
                  Projected value {money(qtyValue * priceValue)}
                </Text>

                <Button
                  label="Save Figures"
                  variant="secondary"
                  block
                  disabled={!numbersChanged}
                  loading={saving}
                  onPress={() => patch({ projectedQty: qtyValue, price: priceValue })}
                />

                <PickerField
                  label="Status"
                  value={PROJECTION_STATUS_LABELS[projection.status]}
                  placeholder="Set a status"
                  onPress={() => setSheet("status")}
                />

                <PickerField
                  label="Next follow-up"
                  value={projection.nextFollowUpAt ? longDate(projection.nextFollowUpAt) : null}
                  placeholder="None scheduled"
                  icon={<CalendarDays size={16} color={color.muted} strokeWidth={2} />}
                  onPress={() => setSheet("followUp")}
                />

                <PickerField
                  label="Expected closure"
                  value={projection.targetDate ? longDate(projection.targetDate) : null}
                  placeholder="Not set"
                  icon={<CalendarDays size={16} color={color.muted} strokeWidth={2} />}
                  onPress={() => setSheet("target")}
                />

                <Input
                  label="Remarks"
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Where this stands"
                  multiline
                  numberOfLines={3}
                />
                <Button
                  label="Save Remarks"
                  variant="secondary"
                  block
                  disabled={!remarksChanged}
                  loading={saving}
                  onPress={() => patch({ remarks: remarks.trim() || null })}
                />
              </>
            ) : (
              <Panel style={styles.panel}>
                <KeyValueRow
                  label="Next follow-up"
                  value={projection.nextFollowUpAt ? longDate(projection.nextFollowUpAt) : null}
                  emptyText="None scheduled"
                />
                <RowDivider />
                <KeyValueRow
                  label="Expected closure"
                  value={projection.targetDate ? longDate(projection.targetDate) : null}
                  emptyText="Not set"
                />
                <RowDivider />
                <KeyValueRow label="Remarks" value={projection.remarks} emptyText="None" />
              </Panel>
            )}

            {error ? (
              <Text variant="caption" tone="red">
                {error}
              </Text>
            ) : saved ? (
              <Text variant="caption" tone="primaryDark">
                Saved.
              </Text>
            ) : null}

            <Text variant="section" style={styles.heading}>
              Follow-up log
            </Text>
            {(state.data?.followUps.length ?? 0) === 0 ? (
              <Panel>
                <Text variant="body" tone="muted">
                  No follow-ups recorded for this customer yet.
                </Text>
              </Panel>
            ) : (
              state.data?.followUps.slice(0, 6).map((followUp) => (
                <Card
                  key={followUp.id}
                  onPress={() => router.push(`/followup/${followUp.id}`)}
                  style={styles.logRow}
                >
                  <View style={styles.logInner}>
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

            {!locked ? (
              <>
                <Button
                  label="Convert to Sales Order"
                  block
                  icon={<ShoppingCart size={16} color={color.surfaceWhite} strokeWidth={2} />}
                  onPress={() =>
                    router.push(
                      `/order/new?customerId=${projection.customerId}&productId=${projection.productId}`,
                    )
                  }
                  style={styles.heading}
                />
                <Button
                  label="Delete Projection"
                  variant="destructive"
                  block
                  icon={<Trash2 size={16} color={color.surfaceWhite} strokeWidth={2} />}
                  onPress={confirmDelete}
                />
              </>
            ) : null}
          </>
        )}
      </View>

      <OptionSheet
        visible={sheet === "status"}
        onClose={() => setSheet(null)}
        title="Status"
        options={PROJECTION_STATUSES.map((value) => ({
          value,
          label: PROJECTION_STATUS_LABELS[value],
        }))}
        value={(projection?.status as ProjectionStatus) ?? null}
        onChange={(next) => patch({ status: next })}
      />
      <DatePickerSheet
        visible={sheet === "followUp"}
        onClose={() => setSheet(null)}
        value={projection?.nextFollowUpAt ? projection.nextFollowUpAt.slice(0, 10) : null}
        onChange={(next) =>
          patch({ nextFollowUpAt: new Date(`${next}T10:00:00`).toISOString() })
        }
        min={toDateKey(new Date())}
        title="Next follow-up"
      />
      <DatePickerSheet
        visible={sheet === "target"}
        onClose={() => setSheet(null)}
        value={projection?.targetDate ? projection.targetDate.slice(0, 10) : null}
        onChange={(next) => patch({ targetDate: new Date(`${next}T10:00:00`).toISOString() })}
        title="Expected closure"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
  headRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  headText: { flex: 1, gap: 2 },
  lockRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  lockText: { flex: 1 },
  panel: { paddingVertical: space.xs },
  pair: { flexDirection: "row", gap: space.md },
  pairItem: { flex: 1 },
  heading: { marginTop: space.md },
  logRow: { paddingVertical: space.md },
  logInner: { flexDirection: "row", alignItems: "center", gap: space.md },
});
