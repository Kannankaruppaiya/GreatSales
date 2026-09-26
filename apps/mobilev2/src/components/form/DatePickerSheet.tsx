/**
 * Choosing a date: day, month and year, each picked on its own.
 *
 * Three columns rather than a month grid, because that is the pattern people
 * already know from nearly every form they fill in, and it is the one this
 * product uses for every date field. Written rather than pulled in:
 * `@react-native-community/datetimepicker` has no web target, and a control
 * the app draws itself behaves the same on every platform.
 *
 * The chosen day is clamped to the month (picking 31 then February lands on
 * the 28th or 29th rather than rolling into March), and anything before `min`
 * is shown but cannot be picked, so the columns never jump around under the
 * person's thumb.
 *
 * Dates are local `YYYY-MM-DD` strings throughout. Going through `Date` and
 * `toISOString()` shifts the day backwards for anyone east of UTC, which is
 * everyone using this app.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { Text } from "../ui/Text";
import { color, font, radius, space } from "@/design/tokens";

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

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ROW = 44;

function daysIn(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
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
  const start = fromDateKey(value ?? (min && min > today ? min : today));

  const [year, setYear] = useState(start.getFullYear());
  const [month, setMonth] = useState(start.getMonth());
  const [day, setDay] = useState(start.getDate());

  // Re-seed from the field each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    const d = fromDateKey(value ?? (min && min > today ? min : today));
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setDay(d.getDate());
  }, [visible, value, min, today]);

  // Ten years either side of now covers every date this app is asked for.
  const thisYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 21 }, (_, i) => thisYear - 10 + i),
    [thisYear],
  );
  const days = useMemo(
    () => Array.from({ length: daysIn(year, month) }, (_, i) => i + 1),
    [year, month],
  );

  // Picking a shorter month clamps the day instead of rolling over.
  const safeDay = Math.min(day, daysIn(year, month));
  const key = toDateKey(new Date(year, month, safeDay));
  const tooEarly = min != null && key < min;

  const allowed = (y: number, m: number, d: number) =>
    min == null || toDateKey(new Date(y, m, Math.min(d, daysIn(y, m)))) >= min;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <View style={styles.footer}>
          <Button
            label="Today"
            variant="secondary"
            style={styles.footerButton}
            disabled={min != null && today < min}
            onPress={() => {
              onChange(today);
              onClose();
            }}
          />
          <Button
            label="Done"
            style={styles.footerButton}
            disabled={tooEarly}
            onPress={() => {
              onChange(key);
              onClose();
            }}
          />
        </View>
      }
    >
      <View style={styles.columns}>
        <Column
          label="Day"
          items={days.map((d) => ({
            key: d,
            label: String(d).padStart(2, "0"),
            disabled: !allowed(year, month, d),
          }))}
          selected={safeDay}
          onSelect={setDay}
          visible={visible}
        />
        <Column
          label="Month"
          items={MONTHS.map((name, m) => ({
            key: m,
            label: name,
            disabled: min != null && toDateKey(new Date(year, m + 1, 0)) < min,
          }))}
          selected={month}
          onSelect={setMonth}
          visible={visible}
          flex={1.3}
        />
        <Column
          label="Year"
          items={years.map((y) => ({
            key: y,
            label: String(y),
            disabled: min != null && `${y}-12-31` < min,
          }))}
          selected={year}
          onSelect={setYear}
          visible={visible}
          flex={1.4}
        />
      </View>
      <Text variant="caption" tone={tooEarly ? "red" : "muted"} align="center">
        {tooEarly
          ? "That date has already passed."
          : fromDateKey(key).toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
      </Text>
    </BottomSheet>
  );
}

function Column({
  label,
  items,
  selected,
  onSelect,
  visible,
  flex = 1,
}: {
  label: string;
  items: { key: number; label: string; disabled: boolean }[];
  selected: number;
  onSelect: (key: number) => void;
  visible: boolean;
  flex?: number;
}) {
  const scroll = useRef<ScrollView>(null);
  const index = items.findIndex((i) => i.key === selected);

  // Bring the chosen value into view when the sheet opens.
  useEffect(() => {
    if (!visible || index < 0) return;
    const id = setTimeout(
      () =>
        scroll.current?.scrollTo({
          y: Math.max(0, (index - 2) * ROW),
          animated: false,
        }),
      0,
    );
    return () => clearTimeout(id);
  }, [visible, index]);

  return (
    <View style={[styles.column, { flex }]}>
      <Text variant="nano" tone="muted" align="center">
        {label}
      </Text>
      <ScrollView
        ref={scroll}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {items.map((item) => {
          const active = item.key === selected;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${item.label}`}
              accessibilityState={{ selected: active, disabled: item.disabled }}
              disabled={item.disabled}
              onPress={() => onSelect(item.key)}
              style={[styles.cell, active ? styles.cellActive : null]}
            >
              <Text
                style={[
                  styles.cellText,
                  active ? styles.cellTextActive : null,
                  item.disabled ? styles.cellTextDisabled : null,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
  column: { gap: space.xs },
  list: {
    height: ROW * 5,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surfaceWhite,
  },
  cell: {
    height: ROW,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    borderRadius: radius.input,
  },
  cellActive: { backgroundColor: color.primary },
  cellText: { fontFamily: font.semibold, fontSize: 15, color: color.ink },
  cellTextActive: { color: color.surfaceWhite },
  cellTextDisabled: { color: color.line },
  footer: { flexDirection: "row", gap: space.md },
  footerButton: { flex: 1 },
});
