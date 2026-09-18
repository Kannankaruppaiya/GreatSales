/**
 * 03.5 / 03D — Move to Stage.
 *
 * From the Penpot board "03.5 Move Stage": the opportunity summary at the top,
 * the stage list with the current one ticked, and the update action.
 *
 * Only the stages a salesperson may set are offered. "Trial Problem" exists in
 * the schema but is set by the trials process rather than chosen here, so it is
 * shown when a deal is already in it and never as a destination.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Building2, CircleCheckBig, IndianRupee } from "lucide-react-native";
import type { DealStageValue, LeadRow } from "@greatsales/shared";

import { BottomSheet, Button, Panel, Text } from "@/components/ui";
import { color, font, radius, space } from "@/design/tokens";
import { money } from "@/lib/format";
import { stageVisual } from "@/lib/stage-visuals";
import { DEAL_STAGE_LABELS, SELECTABLE_STAGES } from "@/lib/labels";

export interface ChangeStageSheetProps {
  visible: boolean;
  onClose: () => void;
  lead: LeadRow | null;
  onConfirm: (stage: DealStageValue) => Promise<void> | void;
}

export function ChangeStageSheet({
  visible,
  onClose,
  lead,
  onConfirm,
}: ChangeStageSheetProps) {
  const [selected, setSelected] = useState<DealStageValue | null>(null);
  const [saving, setSaving] = useState(false);

  const current = lead?.stage ?? null;
  const target = selected ?? current;

  // A stage the deal is already in is shown even when it is not selectable, so
  // the sheet never hides where the deal actually stands.
  const stages = SELECTABLE_STAGES.includes(current as DealStageValue)
    ? SELECTABLE_STAGES
    : ([...SELECTABLE_STAGES, current].filter(Boolean) as DealStageValue[]);

  async function save() {
    if (!target || target === current) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onConfirm(target);
      onClose();
    } finally {
      setSaving(false);
      setSelected(null);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Move to Stage"
      footer={
        <Button
          label="Update Stage"
          block
          loading={saving}
          disabled={!target || target === current}
          onPress={save}
        />
      }
    >
      {lead ? (
        <Panel tone="mint" style={styles.summary}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryTile}>
              <Building2 size={19} color={color.primaryDark} strokeWidth={2} />
            </View>
            <View style={styles.summaryText}>
              <Text variant="cardTitle" numberOfLines={1}>
                {lead.products[0]?.productName ?? lead.customerName}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {lead.customerName}
              </Text>
              <View style={styles.summaryValue}>
                <IndianRupee size={12} color={color.primaryDark} strokeWidth={2.5} />
                <Text variant="micro" tone="primaryDark">
                  {money(lead.totalValue).replace("₹ ", "")}
                </Text>
              </View>
            </View>
          </View>
        </Panel>
      ) : null}

      <View style={styles.list}>
        {stages.map((stage) => {
          const spec = stageVisual(stage);
          const active = target === stage;
          return (
            <Pressable
              key={stage}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={DEAL_STAGE_LABELS[stage]}
              onPress={() => setSelected(stage)}
              style={[styles.row, active ? styles.rowActive : null]}
            >
              <View style={[styles.tile, { backgroundColor: spec.bg }]}>
                <spec.Icon size={15} color={spec.fg} strokeWidth={2} />
              </View>
              <Text
                variant="body"
                style={[styles.rowLabel, active ? styles.rowLabelActive : null]}
              >
                {DEAL_STAGE_LABELS[stage]}
              </Text>
              {active ? (
                <CircleCheckBig size={19} color={color.primary} strokeWidth={2} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  summary: { marginBottom: space.xl },
  summaryRow: { flexDirection: "row", gap: space.md },
  summaryTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: color.surfaceWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: { flex: 1, gap: 2 },
  summaryValue: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  list: { backgroundColor: "#F7FAFB", borderRadius: radius.listCard, padding: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.input,
  },
  rowActive: { backgroundColor: color.surfaceWhite },
  tile: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1 },
  rowLabelActive: { fontFamily: font.bold },
});
