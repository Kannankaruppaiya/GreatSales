/**
 * 07 / 07A / 07B — Recurring Projections.
 *
 * A month of projected sales per customer and product, against what was
 * actually achieved. The month selector (07A) and the filters (07B) are sheets
 * on this screen rather than routes, because both only ever change what this
 * list shows.
 *
 * A locked period is marked in the selector and again above the list, so the
 * read-only state is known before a row is opened and found uneditable.
 */
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, Lock } from "lucide-react-native";

import {
  Card,
  Chip,
  EmptyState,
  KeyValueRow,
  Panel,
  Screen,
  SearchBar,
  SkeletonList,
  SyntheticBanner,
  Text,
} from "@/components/ui";
import { OptionSheet, PickerField } from "@/components/form";
import { useData } from "@/data/provider";
import { color, space } from "@/design/tokens";
import { money, moneyShort, percent } from "@/lib/format";
import {
  PROJECTION_STATUSES,
  PROJECTION_STATUS_LABELS,
  PROJECTION_STATUS_TONES,
  defaultPeriod,
  periodLabel,
  type ProjectionStatus,
} from "@/lib/projection-labels";
import { useAsync } from "@/lib/useAsync";

export default function ProjectionsScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectionStatus | null>(null);
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [sheet, setSheet] = useState<"period" | "status" | null>(null);

  const state = useAsync(async () => {
    const periods = await source.listProjectionPeriods();
    const active = period ?? defaultPeriod(periods);
    const rows = active
      ? await source.listProjections({
          period: active,
          search: search || undefined,
          status: status ?? undefined,
          needsFollowUp: needsFollowUp || undefined,
          limit: 100,
        })
      : null;
    return {
      periods,
      active,
      locked: periods.find((p) => p.period === active)?.locked ?? false,
      rows: rows?.items ?? [],
    };
  }, [source, period, search, status, needsFollowUp]);

  const totals = useMemo(() => {
    const rows = state.data?.rows ?? [];
    const projected = rows.reduce((sum, r) => sum + r.projectedValue, 0);
    const achieved = rows.reduce((sum, r) => sum + r.achievedValue, 0);
    return {
      projected,
      achieved,
      achievement: projected > 0 ? (achieved / projected) * 100 : 0,
    };
  }, [state.data]);

  const filtered = Boolean(search || status || needsFollowUp);

  return (
    <Screen onRefresh={state.reload} refreshing={state.refreshing}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text variant="pageTitle">Projections</Text>
        <Text variant="caption" tone="muted">
          {state.data?.rows.length ?? 0} lines
        </Text>
      </View>

      <SyntheticBanner />

      <View style={styles.controls}>
        <PickerField
          value={state.data?.active ? periodLabel(state.data.active) : null}
          placeholder="Choose a month"
          icon={<CalendarDays size={16} color={color.muted} strokeWidth={2} />}
          onPress={() => setSheet("period")}
        />

        {state.data?.locked ? (
          <Panel tone="amber" style={styles.locked}>
            <View style={styles.lockedRow}>
              <Lock size={16} color={color.amber} strokeWidth={2} />
              <Text variant="caption" tone="amber" style={styles.lockedText}>
                This month is closed. Its projections can be read but not
                changed.
              </Text>
            </View>
          </Panel>
        ) : null}

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer or product"
        />

        <View style={styles.filters}>
          <Chip
            label={status ? PROJECTION_STATUS_LABELS[status] : "Any status"}
            active={status != null}
            onPress={() => setSheet("status")}
          />
          <Chip
            label="Needs follow-up"
            active={needsFollowUp}
            onPress={() => setNeedsFollowUp((v) => !v)}
          />
        </View>
      </View>

      {state.loading ? (
        <SkeletonList rows={5} />
      ) : (state.data?.rows.length ?? 0) === 0 ? (
        <EmptyState
          title={filtered ? "Nothing matches" : "No projections this month"}
          body={
            filtered
              ? "Clear the search or the filters to see the rest of the month."
              : "Projections are created in the web console and roll forward each month."
          }
          actionLabel={filtered ? "Clear filters" : undefined}
          onAction={
            filtered
              ? () => {
                  setSearch("");
                  setStatus(null);
                  setNeedsFollowUp(false);
                }
              : undefined
          }
        />
      ) : (
        <>
          <Panel tone="mint" style={styles.totals}>
            <KeyValueRow label="Projected" value={money(totals.projected)} />
            <KeyValueRow label="Achieved" value={money(totals.achieved)} />
            <KeyValueRow
              label="Achievement"
              value={percent(totals.achievement)}
            />
          </Panel>

          <View style={styles.list}>
            {state.data?.rows.map((row) => {
              const achievement =
                row.projectedValue > 0
                  ? (row.achievedValue / row.projectedValue) * 100
                  : 0;
              return (
                <Card
                  key={row.id}
                  onPress={() => router.push(`/projection/${row.id}`)}
                  accessibilityLabel={`${row.customerName}, ${row.productName}`}
                  style={styles.row}
                >
                  <View style={styles.rowHead}>
                    <View style={styles.rowText}>
                      <Text variant="cardTitle" numberOfLines={1}>
                        {row.customerName}
                      </Text>
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {row.productName} · {row.principal}
                      </Text>
                    </View>
                    <Chip
                      label={PROJECTION_STATUS_LABELS[row.status]}
                      tone={PROJECTION_STATUS_TONES[row.status]}
                    />
                  </View>

                  <View style={styles.rowStats}>
                    <Stat
                      label="Projected"
                      value={moneyShort(row.projectedValue)}
                    />
                    <Stat
                      label="Achieved"
                      value={moneyShort(row.achievedValue)}
                    />
                    <Stat label="Achievement" value={percent(achievement)} />
                  </View>
                </Card>
              );
            })}
          </View>
        </>
      )}

      <OptionSheet
        visible={sheet === "period"}
        onClose={() => setSheet(null)}
        title="Month"
        options={(state.data?.periods ?? []).map((p) => ({
          value: p.period,
          label: periodLabel(p.period),
          hint: p.locked ? "Closed — read only" : undefined,
        }))}
        value={state.data?.active ?? null}
        onChange={setPeriod}
      />
      <OptionSheet
        visible={sheet === "status"}
        onClose={() => setSheet(null)}
        title="Status"
        options={PROJECTION_STATUSES.map((value) => ({
          value,
          label: PROJECTION_STATUS_LABELS[value],
        }))}
        value={status}
        onChange={setStatus}
        clearLabel="Any status"
        onClear={() => setStatus(null)}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="nano" tone="muted">
        {label}
      </Text>
      <Text variant="cardTitle">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: space.sm, gap: 2 },
  controls: { gap: space.md, marginTop: space.md, paddingBottom: space.lg },
  locked: {},
  lockedRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  lockedText: { flex: 1 },
  filters: { flexDirection: "row", gap: space.sm },
  totals: { paddingVertical: space.xs, marginBottom: space.lg },
  list: { gap: space.md },
  row: { gap: space.md },
  rowHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowText: { flex: 1, gap: 2 },
  rowStats: { flexDirection: "row", gap: space.md },
  stat: { flex: 1, gap: 2 },
});
