/**
 * A searchable list in a sheet, for choosing one record.
 *
 * Every create flow has to pick a customer or a product (04A, 06B, 06C, 08D,
 * 08E). Rather than a screen each, they share this: it searches through the
 * data source, so it narrows server-side where the API supports it instead of
 * filtering whatever happened to be on the first page.
 *
 * `onCreate` is optional and renders as a row under the results — 04A's
 * "Create new customer" branch, reachable without first failing a search.
 */
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Plus } from "lucide-react-native";

import { BottomSheet } from "../ui/BottomSheet";
import { EmptyState } from "../ui/EmptyState";
import { SearchBar } from "../ui/SearchBar";
import { SkeletonList } from "../ui/Skeleton";
import { Text } from "../ui/Text";
import { color, radius, space } from "@/design/tokens";

export interface EntityOption {
  id: string;
  title: string;
  subtitle?: string | null;
  /** Shown right-aligned — a price, an amount, a count. */
  meta?: string | null;
}

export interface EntityPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  placeholder: string;
  /** Called on open and on every search term. */
  load: (search: string) => Promise<EntityOption[]>;
  onSelect: (option: EntityOption) => void;
  selectedId?: string | null;
  onCreate?: () => void;
  createLabel?: string;
  emptyTitle?: string;
  emptyBody?: string;
}

export function EntityPickerSheet({
  visible,
  onClose,
  title,
  placeholder,
  load,
  onSelect,
  selectedId,
  onCreate,
  createLabel,
  emptyTitle = "Nothing found",
  emptyBody = "Try a shorter search, or a different spelling.",
}: EntityPickerSheetProps) {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    setLoading(true);
    // A late response from an earlier term must not overwrite a newer one.
    load(search)
      .then((rows) => {
        if (live) setOptions(rows);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [visible, search, load]);

  // Reopening starts clean rather than on the last search.
  useEffect(() => {
    if (!visible) setSearch("");
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.searchRow}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={placeholder} />
      </View>

      {loading && options.length === 0 ? (
        <SkeletonList rows={4} />
      ) : options.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          body={emptyBody}
          actionLabel={onCreate ? createLabel : undefined}
          onAction={onCreate}
        />
      ) : (
        <View style={styles.list}>
          {options.map((option) => {
            const selected = option.id === selectedId;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={option.title}
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
                style={[styles.row, selected ? styles.rowSelected : null]}
              >
                <View style={styles.rowText}>
                  <Text variant="cardTitle" numberOfLines={1}>
                    {option.title}
                  </Text>
                  {option.subtitle ? (
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {option.subtitle}
                    </Text>
                  ) : null}
                </View>
                {option.meta ? (
                  <Text variant="secondary" tone="muted">
                    {option.meta}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {onCreate && options.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={createLabel ?? "Create new"}
          onPress={() => {
            onClose();
            onCreate();
          }}
          style={styles.createRow}
        >
          <Plus size={17} color={color.primaryDark} strokeWidth={2.5} />
          <Text variant="body" tone="primaryDark">
            {createLabel ?? "Create new"}
          </Text>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchRow: { paddingBottom: space.md },
  list: { gap: space.sm, paddingBottom: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surfaceWhite,
  },
  rowSelected: { borderColor: color.primary, backgroundColor: color.mintTint },
  rowText: { flex: 1, gap: 2 },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    minHeight: 48,
    marginBottom: space.md,
  },
});
