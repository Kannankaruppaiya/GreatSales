/**
 * 03E.3 — Filter Activity.
 *
 * Activity Type as checkboxes with live counts, and Date Range as a radio
 * group, from the board of the same name.
 *
 * Two of the board's controls are not built. "Performed By" offers All Users
 * or a specific user: every activity this app can read is the signed-in
 * salesperson's own, so the filter would never remove a row. "Custom Range"
 * needs a date picker and a backend that takes a range; the four fixed windows
 * cover what the screen is for.
 */
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { color, radius, space } from "@/design/tokens";
import {
  ACTIVITY_GROUP_LABELS,
  ACTIVITY_GROUP_ORDER,
  ACTIVITY_ICONS,
  ACTIVITY_RANGE_LABELS,
  type ActivityGroup,
  type ActivityRange,
} from "@/lib/activity";

export interface ActivityFilters {
  /** Empty means every type — the board's "All" chip. */
  groups: ActivityGroup[];
  range: ActivityRange;
}

export const NO_ACTIVITY_FILTERS: ActivityFilters = {
  groups: [],
  range: "all",
};

export function activityFilterCount(f: ActivityFilters): number {
  return f.groups.length + (f.range === "all" ? 0 : 1);
}

export interface ActivityFiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  value: ActivityFilters;
  onApply: (next: ActivityFilters) => void;
  /** Row counts per type, over the whole timeline rather than the filtered view. */
  counts: Record<ActivityGroup, number>;
}

export function ActivityFiltersSheet({
  visible,
  onClose,
  value,
  onApply,
  counts,
}: ActivityFiltersSheetProps) {
  const [draft, setDraft] = useState<ActivityFilters>(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Activity"
      footer={
        <View style={styles.footer}>
          <Button
            label="Clear All"
            variant="secondary"
            style={styles.half}
            onPress={() => setDraft(NO_ACTIVITY_FILTERS)}
          />
          <Button
            label="Apply Filters"
            style={styles.half}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </View>
      }
    >
      <Text variant="secondary" style={styles.sectionTitle}>
        Activity Type
      </Text>
      {ACTIVITY_GROUP_ORDER.map((group) => {
        const Icon = ACTIVITY_ICONS[group];
        const on = draft.groups.includes(group);
        return (
          <Pressable
            key={group}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${ACTIVITY_GROUP_LABELS[group]}, ${counts[group]}`}
            onPress={() =>
              setDraft((d) => ({
                ...d,
                groups: on
                  ? d.groups.filter((g) => g !== group)
                  : [...d.groups, group],
              }))
            }
            style={styles.row}
          >
            <View style={[styles.box, on && styles.boxOn]}>
              {on ? (
                <Check size={13} color={color.surfaceWhite} strokeWidth={3} />
              ) : null}
            </View>
            <Icon size={17} color={color.muted} strokeWidth={2} />
            <Text variant="body" style={styles.rowLabel}>
              {ACTIVITY_GROUP_LABELS[group]}
            </Text>
            <Text variant="secondary" tone="muted">
              {counts[group]}
            </Text>
          </Pressable>
        );
      })}

      <Text
        variant="secondary"
        style={[styles.sectionTitle, styles.sectionGap]}
      >
        Date Range
      </Text>
      {(Object.keys(ACTIVITY_RANGE_LABELS) as ActivityRange[]).map((range) => {
        const on = draft.range === range;
        return (
          <Pressable
            key={range}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => setDraft((d) => ({ ...d, range }))}
            style={styles.row}
          >
            <View style={[styles.dial, on && styles.dialOn]}>
              {on ? <View style={styles.dialDot} /> : null}
            </View>
            <Text variant="body" style={styles.rowLabel}>
              {ACTIVITY_RANGE_LABELS[range]}
            </Text>
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: color.ink,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  sectionGap: { marginTop: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
  },
  rowLabel: { flex: 1 },
  box: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#C6D5DD",
    backgroundColor: color.surfaceWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: color.primary, borderColor: color.primary },
  dial: {
    width: 19,
    height: 19,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#C6D5DD",
    alignItems: "center",
    justifyContent: "center",
  },
  dialOn: { borderColor: color.primary },
  dialDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
  },
  footer: { flexDirection: "row", gap: space.md },
  half: { flex: 1 },
});
