/**
 * 05B — Customer filters.
 *
 * Category, area and industry are the three the API's customer list actually
 * takes, plus the outstanding flag. "Salesperson" is on the board and is not
 * here: every customer this app can read is already the signed-in
 * salesperson's, so the filter would never remove a row.
 *
 * Areas and industries are offered as the values present in the loaded
 * customers rather than from a lookup table, because there is no endpoint that
 * lists them and a hardcoded list would go stale the first time a new area is
 * entered.
 */
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import type { CustomerCategoryValue } from "@greatsales/shared";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Text } from "@/components/ui/Text";
import { color, space } from "@/design/tokens";
import { CUSTOMER_CATEGORY_LABELS } from "@/lib/labels";

export interface CustomerFilters {
  category: CustomerCategoryValue | null;
  area: string | null;
  /** Industry master row — the id filters, the name labels the chip. */
  industry: { id: string; name: string } | null;
  withOutstanding: boolean;
}

export const NO_CUSTOMER_FILTERS: CustomerFilters = {
  category: null,
  area: null,
  industry: null,
  withOutstanding: false,
};

export function customerFilterCount(f: CustomerFilters): number {
  return (
    (f.category ? 1 : 0) +
    (f.area ? 1 : 0) +
    (f.industry ? 1 : 0) +
    (f.withOutstanding ? 1 : 0)
  );
}

export interface CustomerFiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  value: CustomerFilters;
  onApply: (next: CustomerFilters) => void;
  /** Values seen in the loaded rows, so a chip never filters to nothing. */
  areas: string[];
  /** The tenant's industry master list. */
  industries: { id: string; name: string }[];
}

export function CustomerFiltersSheet({
  visible,
  onClose,
  value,
  onApply,
  areas,
  industries,
}: CustomerFiltersSheetProps) {
  const [draft, setDraft] = useState<CustomerFilters>(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Customers"
      footer={
        <View style={styles.footer}>
          <Button
            label="Clear All"
            variant="secondary"
            style={styles.half}
            onPress={() => setDraft(NO_CUSTOMER_FILTERS)}
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
      <Section title="Category">
        <View style={styles.chips}>
          {(
            Object.keys(CUSTOMER_CATEGORY_LABELS) as CustomerCategoryValue[]
          ).map((key) => (
            <Chip
              key={key}
              label={CUSTOMER_CATEGORY_LABELS[key]}
              active={draft.category === key}
              onPress={() =>
                setDraft((d) => ({
                  ...d,
                  category: d.category === key ? null : key,
                }))
              }
            />
          ))}
        </View>
      </Section>

      {areas.length > 0 ? (
        <Section title="Area">
          <View style={styles.chips}>
            {areas.map((area) => (
              <Chip
                key={area}
                label={area}
                active={draft.area === area}
                onPress={() =>
                  setDraft((d) => ({
                    ...d,
                    area: d.area === area ? null : area,
                  }))
                }
              />
            ))}
          </View>
        </Section>
      ) : null}

      {industries.length > 0 ? (
        <Section title="Industry">
          <View style={styles.chips}>
            {industries.map((industry) => (
              <Chip
                key={industry.id}
                label={industry.name}
                active={draft.industry?.id === industry.id}
                onPress={() =>
                  setDraft((d) => ({
                    ...d,
                    industry: d.industry?.id === industry.id ? null : industry,
                  }))
                }
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="Payments">
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.withOutstanding }}
          onPress={() =>
            setDraft((d) => ({ ...d, withOutstanding: !d.withOutstanding }))
          }
          style={styles.row}
        >
          <View style={[styles.box, draft.withOutstanding && styles.boxOn]}>
            {draft.withOutstanding ? (
              <Check size={13} color={color.surfaceWhite} strokeWidth={3} />
            ) : null}
          </View>
          <Text variant="body" style={styles.rowLabel}>
            Has an outstanding balance
          </Text>
        </Pressable>
      </Section>
    </BottomSheet>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text variant="secondary" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: space.lg, gap: space.sm },
  sectionTitle: { color: color.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
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
  footer: { flexDirection: "row", gap: space.md },
  half: { flex: 1 },
});
