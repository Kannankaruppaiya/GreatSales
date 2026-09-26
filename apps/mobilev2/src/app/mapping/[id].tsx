/**
 * 06H — Edit / delete a mapping.
 *
 * The agreed price is the only thing a mapping holds that is a decision; the
 * customer and the product are what it is. Changing either of those would
 * make it a different mapping, so they are shown and not edited, and the
 * delete below is the way to undo the pairing.
 *
 * Delete asks first and says what disappears, because the agreed price is the
 * only record that this customer negotiated one.
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { IndianRupee, Trash2 } from "lucide-react-native";

import {
  AppBar,
  Button,
  Card,
  EmptyState,
  Input,
  KeyValueRow,
  Panel,
  RowDivider,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { describeError } from "@/data/http";
import { confirmAction } from "@/lib/confirm";
import { color, space } from "@/design/tokens";
import { longDate, money } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { leave } from "@/lib/nav";

export default function MappingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const source = useData();

  const state = useAsync(
    () => (id ? source.getMapping(id) : Promise.resolve(null)),
    [source, id],
  );
  const mapping = state.data ?? null;

  const [agreed, setAgreed] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The field is seeded once the row arrives, not on every render — otherwise
  // it would overwrite what the person is typing on the next reload.
  useEffect(() => {
    if (mapping)
      setAgreed(mapping.agreedPrice != null ? String(mapping.agreedPrice) : "");
  }, [mapping?.id, mapping?.agreedPrice]);

  const agreedValue =
    agreed.trim() === "" ? null : Number(agreed.replace(/[^0-9.]/g, ""));
  const changed =
    mapping != null && agreedValue !== (mapping.agreedPrice ?? null);

  async function save() {
    if (!mapping) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await source.updateMapping(mapping.id, { agreedPrice: agreedValue });
      setSaved(true);
      state.reload();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!mapping) return;
    const ok = await confirmAction({
      title: "Delete this mapping?",
      message: `${mapping.customerName} will no longer be mapped to ${mapping.productName}, so it drops out of their recurring projections. This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Keep it",
      destructive: true,
    });
    if (ok) await remove();
  }

  async function remove() {
    if (!mapping) return;
    setDeleting(true);
    setError(null);
    try {
      await source.deleteMapping(mapping.id);
      leave(router, "/mappings");
    } catch (e) {
      setError(describeError(e));
      setDeleting(false);
    }
  }

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="Mapping" />

      <View style={styles.body}>
        {state.loading ? (
          <SkeletonList rows={3} />
        ) : !mapping ? (
          <EmptyState
            title="Mapping not found"
            body="It may have been deleted since this screen was opened."
            actionLabel="Back to Mappings"
            onAction={() => router.replace("/mappings")}
          />
        ) : (
          <>
            <Card>
              <Text variant="section" numberOfLines={2}>
                {mapping.productName}
              </Text>
              <Text variant="body" tone="muted">
                {mapping.customerName}
              </Text>
            </Card>

            <Panel style={styles.panel}>
              <KeyValueRow label="Principal" value={mapping.principal} />
              <RowDivider />
              <KeyValueRow
                label="List price"
                value={money(mapping.listPrice)}
              />
              <RowDivider />
              <KeyValueRow label="Salesperson" value={mapping.ownerName} />
              <RowDivider />
              <KeyValueRow
                label="Mapped on"
                value={longDate(mapping.createdAt)}
              />
            </Panel>

            <Input
              label="Agreed price"
              value={agreed}
              onChangeText={setAgreed}
              keyboardType="numeric"
              placeholder={
                mapping.listPrice != null
                  ? String(mapping.listPrice)
                  : "No list price"
              }
              icon={
                <IndianRupee size={15} color={color.muted} strokeWidth={2} />
              }
              hint={
                mapping.listPrice != null
                  ? "Leave it empty to charge the list price"
                  : "The catalogue has no price for this product — set one here"
              }
            />

            {agreedValue != null &&
            mapping.listPrice != null &&
            agreedValue !== mapping.listPrice ? (
              <Text
                variant="caption"
                tone={agreedValue < mapping.listPrice ? "amber" : "primaryDark"}
              >
                {agreedValue < mapping.listPrice
                  ? `${money(mapping.listPrice - agreedValue)} below list price.`
                  : `${money(agreedValue - mapping.listPrice)} above list price.`}
              </Text>
            ) : null}

            {error ? (
              <Text variant="caption" tone="red">
                {error}
              </Text>
            ) : saved && !changed ? (
              <Text variant="caption" tone="primaryDark">
                Saved.
              </Text>
            ) : null}

            <Button
              label="Save Price"
              block
              disabled={!changed}
              loading={saving}
              onPress={save}
            />

            <Button
              label="Delete Mapping"
              variant="destructive"
              block
              loading={deleting}
              icon={
                <Trash2 size={16} color={color.surfaceWhite} strokeWidth={2} />
              }
              onPress={confirmDelete}
              style={styles.delete}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
  panel: { paddingVertical: space.xs },
  delete: { marginTop: space.md },
});
