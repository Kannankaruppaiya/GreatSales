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
import { Alert, StyleSheet, View } from "react-native";
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
import { isMutable } from "@/data/source";
import { color, space } from "@/design/tokens";
import { longDate, money } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

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
    if (!mapping || !isMutable(source)) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await source.updateMapping(mapping.id, { agreedPrice: agreedValue });
      setSaved(true);
      state.reload();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The price could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!mapping) return;
    Alert.alert(
      "Delete this mapping?",
      `${mapping.customerName} will no longer have an agreed price for ${mapping.productName}, and quotes will fall back to the list price. This cannot be undone.`,
      [
        { text: "Keep it", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: remove },
      ],
    );
  }

  async function remove() {
    if (!mapping || !isMutable(source)) return;
    setDeleting(true);
    setError(null);
    try {
      await source.deleteMapping(mapping.id);
      router.back();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The mapping could not be deleted.",
      );
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
              placeholder={String(mapping.listPrice)}
              icon={
                <IndianRupee size={15} color={color.muted} strokeWidth={2} />
              }
              hint="Leave it empty to charge the list price"
            />

            {agreedValue != null && agreedValue !== mapping.listPrice ? (
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
