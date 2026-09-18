/**
 * A month grid in a bottom sheet, for choosing a date.
 *
 * Written rather than pulled in: `@react-native-community/datetimepicker` has
 * no web target, and this app is verified by exporting to web and driving a
 * real browser. A calendar the app draws itself works the same on every target
 * and matches the design's own surfaces.
 *
 * Dates are handled as local `YYYY-MM-DD` strings throughout. Going through
 * `Date` and `toISOString()` shifts the day backwards for anyone east of UTC,
 * which is everyone using this app.
 */
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { Text } from "../ui/Text";
import { color, radius, space } from "@/design/tokens";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** `YYYY-MM-DD`, or null for no date chosen yet. */
  value: string | null;
  onChange: (next: string) => void;
  title?: string;
  /** Days before this one cannot be chosen. `YYYY-MM-DD`. */
  min?: string;
}

export function DatePickerSheet({
  visible,
  onClose,
  value,
  onChange,
  title = "Pick a date",
  min,
}: DatePickerSheetProps) {
  const today = useMemo(() => toDateKey(new Date()), []);
  const [cursor, setCursor] = useState(() => fromDateKey(value ?? today));

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // Monday-first, which is how the week is read here.
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();

    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= days; day += 1) {
      cells.push(toDateKey(new Date(year, month, day)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <Button
          label="Today"
          variant="secondary"
          block
          onPress={() => {
            onChange(today);
            onClose();
          }}
        />
      }
    >
      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={12}
          onPress={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
        >
          <ChevronLeft size={19} color={color.ink} strokeWidth={2} />
        </Pressable>
        <Text variant="cardTitle" align="center" style={styles.monthLabel}>
          {monthLabel}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={12}
          onPress={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
        >
          <ChevronRight size={19} color={color.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.week}>
        {WEEKDAYS.map((day, i) => (
          <Text key={`${day}${i}`} variant="nano" tone="muted2" align="center" style={styles.cell}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {grid.map((key, index) => {
          if (!key) return <View key={`blank-${index}`} style={styles.cell} />;
          const selected = key === value;
          const blocked = min != null && key < min;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: blocked }}
              accessibilityLabel={fromDateKey(key).toDateString()}
              disabled={blocked}
              onPress={() => {
                onChange(key);
                onClose();
              }}
              style={[styles.cell, styles.day, selected ? styles.daySelected : null]}
            >
              <Text
                variant="secondary"
                align="center"
                tone={selected ? "surfaceWhite" : blocked ? "muted2" : key === today ? "primary" : "ink"}
              >
                {Number(key.slice(8))}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.sm,
  },
  monthLabel: { flex: 1 },
  week: { flexDirection: "row", paddingBottom: space.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingBottom: space.md },
  // Seven to a row, whatever the sheet's width.
  cell: { width: `${100 / 7}%`, height: 40, justifyContent: "center" },
  day: { alignItems: "center", borderRadius: radius.pill },
  daySelected: { backgroundColor: color.primary },
});
