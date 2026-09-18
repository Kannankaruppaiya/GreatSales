/**
 * 03A.2 / 03B.1–03B.4 — Pipeline filters.
 *
 * The Penpot boards give two treatments of the same idea: "03A.2 Filters" as a
 * full screen of checkboxes with counts, and "03B.2 Filter Options" as a sheet
 * of rows that drill into pickers. This is the first, presented in the sheet of
 * the second — the counts are the useful part, and drilling into eight separate
 * pickers to set two filters is worse on a phone.
 *
 * Two sections on the boards are deliberately absent:
 *
 * - **Probability.** There is no per-deal probability in the schema. The one
 *   the app shows elsewhere is derived from the stage, so a probability filter
 *   would be the stage filter under a second name, and its counts would agree
 *   with nothing.
 * - **My Deals.** Every opportunity this app can read already belongs to the
 *   signed-in salesperson, so the filter would never remove a row.
 *
 * Counts are live — they come from the source's stage aggregate, so they stay
 * right as the pipeline moves rather than being drawn once.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import type { DealStageValue } from "@greatsales/shared";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { color, radius, space } from "@/design/tokens";
import { DEAL_STAGE_LABELS, SELECTABLE_STAGES } from "@/lib/labels";

/** The expected-closure windows on the board, as offsets from today. */
export type ClosureWindow = "month" | "nextMonth" | "quarter";

export const CLOSURE_LABELS: Record<ClosureWindow, string> = {
  month: "This Month",
  nextMonth: "Next Month",
  quarter: "Next Quarter",
};

export interface PipelineFilters {
  stages: DealStageValue[];
  closure: ClosureWindow | null;
  openOnly: boolean;
}

export const NO_FILTERS: PipelineFilters = { stages: [], closure: null, openOnly: true };

export function filterCount(f: PipelineFilters): number {
  return f.stages.length + (f.closure ? 1 : 0) + (f.openOnly ? 0 : 1);
}

/**
 * The last day of the chosen window, as an ISO date. Built from month
 * arithmetic rather than by adding days, so a 31-day month and a February both
 * land on their own last day.
 */
export function closureCutoff(window: ClosureWindow, now: Date = new Date()): string {
  const monthsAhead = window === "month" ? 1 : window === "nextMonth" ? 2 : 4;
  const end = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 0);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(
    end.getDate(),
  ).padStart(2, "0")}`;
}

export interface PipelineFiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  value: PipelineFilters;
  onApply: (next: PipelineFilters) => void;
  /** Open-opportunity counts per stage, for the numbers down the right. */
  stageCounts?: { stage: DealStageValue; count: number }[];
}

export function PipelineFiltersSheet({
  visible,
  onClose,
  value,
  onApply,
  stageCounts,
}: PipelineFiltersSheetProps) {
  // Edited in the sheet and committed on Apply, so closing by the scrim or the
  // X leaves the list exactly as it was.
  const [draft, setDraft] = useState<PipelineFilters>(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const counts = useMemo(() => {
    const map = new Map<DealStageValue, number>();
    for (const row of stageCounts ?? []) map.set(row.stage, row.count);
    return map;
  }, [stageCounts]);

  function toggleStage(stage: DealStageValue) {
    setDraft((d) => ({
      ...d,
      stages: d.stages.includes(stage)
        ? d.stages.filter((s) => s !== stage)
        : [...d.stages, stage],
    }));
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Opportunities"
      footer={
        <View style={styles.footer}>
          <Button
            label="Clear All"
            variant="secondary"
            style={styles.clear}
            onPress={() => setDraft(NO_FILTERS)}
          />
          <Button
            label="Apply Filters"
            style={styles.apply}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </View>
      }
    >
      <Section title="Stage">
        {SELECTABLE_STAGES.map((stage) => (
          <OptionRow
            key={stage}
            kind="check"
            label={DEAL_STAGE_LABELS[stage]}
            count={counts.get(stage)}
            selected={draft.stages.includes(stage)}
            onPress={() => toggleStage(stage)}
          />
        ))}
      </Section>

      <Section title="Expected Closure">
        {(Object.keys(CLOSURE_LABELS) as ClosureWindow[]).map((window) => (
          <OptionRow
            key={window}
            kind="radio"
            label={CLOSURE_LABELS[window]}
            selected={draft.closure === window}
            // Tapping the chosen window again clears it — the board has no
            // "Any" row, and a radio group you cannot leave is a trap.
            onPress={() =>
              setDraft((d) => ({ ...d, closure: d.closure === window ? null : window }))
            }
          />
        ))}
      </Section>

      <Section title="Status">
        <OptionRow
          kind="check"
          label="Open only"
          selected={draft.openOnly}
          onPress={() => setDraft((d) => ({ ...d, openOnly: !d.openOnly }))}
        />
      </Section>
    </BottomSheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="secondary" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function OptionRow({
  kind,
  label,
  count,
  selected,
  onPress,
}: {
  kind: "check" | "radio";
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={kind === "check" ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={count == null ? label : `${label}, ${count}`}
      onPress={onPress}
      style={styles.row}
    >
      <View
        style={[
          kind === "check" ? styles.box : styles.dial,
          selected && (kind === "check" ? styles.boxOn : styles.dialOn),
        ]}
      >
        {selected && kind === "check" ? (
          <Check size={12} color={color.surfaceWhite} strokeWidth={3} />
        ) : null}
        {selected && kind === "radio" ? <View style={styles.dialDot} /> : null}
      </View>

      <Text variant="body" style={styles.rowLabel}>
        {label}
      </Text>

      {count != null ? (
        <Text variant="secondary" tone="muted">
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: space.lg },
  sectionTitle: { marginBottom: space.sm, color: color.ink },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
  },
  rowLabel: { flex: 1 },
  box: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#C9D9E1",
    backgroundColor: color.surfaceWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: color.primary, borderColor: color.primary },
  dial: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#C9D9E1",
    backgroundColor: color.surfaceWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  dialOn: { borderColor: color.primary },
  dialDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
  },
  footer: { flexDirection: "row", gap: space.md },
  clear: { flex: 1 },
  apply: { flex: 1.05 },
});
