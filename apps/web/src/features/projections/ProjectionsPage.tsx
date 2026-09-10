import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { periodLabel } from "@/data/months";
import { MonthSelect } from "@/components/MonthSelect";
import { useMonth, useUi } from "@/store/ui";
import { usePeriodLock } from "@/features/data/periodQueries";
import { useAuth, useAuthRole } from "@/store/auth";
import {
  useProjections,
  useUpdateProjection,
  type ProjectionParams,
} from "@/features/projections/queries";
import {
  PROJ_STATUS_LABELS,
  PROJ_STATUS_VALUES,
  type ProjStatusValue,
} from "@/features/projections/types";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Card, Input, Select } from "@/components/ui";

import { ApiError } from "@/lib/api";

type LineFilter = ProjectionParams["lineFilter"];

export default function ProjectionsPage() {
  // The month is the app-wide one from the UI store, not a copy of it: this
  // page used to seed local state from the store at mount, so the topbar month
  // selector silently stopped applying once the worksheet was open, and the two
  // month controls on screen could disagree.
  // The window's month. A worksheet IS a month, so a week window opens the
  // month containing it — one selection in the store, read two ways.
  const period = useMonth();
  const setPeriod = useUi((s) => s.setMonth);
  const ownerFilter = useUi((s) => s.ownerFilter);
  const accessToken = useAuth((s) => s.accessToken);
  const role = useAuthRole();
  const showSalesperson = role !== "sales";
  const colCount = showSalesperson ? 12 : 11;

  const [search, setSearch] = useState("");
  const [principalId, setPrincipalId] = useState("ALL");
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");

  const params: ProjectionParams = {
    period,
    search: search.trim() || undefined,
    principalId: principalId === "ALL" ? undefined : principalId,
    ownerId: ownerFilter === "ALL" ? undefined : ownerFilter,
    lineFilter,
  };

  const enabled = !!accessToken;
  const { data, isLoading, isFetching, error, refetch } = useProjections(
    params,
    enabled,
  );
  const update = useUpdateProjection();

  // Principal filter options are derived from whatever the API returned.
  const principals = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of data?.lines ?? []) map.set(l.principalId, l.principalName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [data]);

  const monthLabel = periodLabel(period);
  const lines = data?.lines ?? [];
  const summary = data?.summary;

  // A locked month is read-only. The server is the enforcement — it refuses the
  // PATCH for every role — and this is what stops the user finding that out by
  // typing a number and watching it bounce back with an error.
  const lock = usePeriodLock(period);
  const isLocked = !!lock;

  const patchCell = (id: string, patch: Parameters<typeof update.mutate>[0]["patch"]) =>
    update.mutate({ id, patch });

  return (
    <div className="space-y-4">
      {isLocked && lock && (
        <div className="rounded-xl border border-amber/40 bg-amber-soft px-3.5 py-2.5 text-xs font-semibold text-amber-900">
          {monthLabel} is locked for reporting — locked by {lock.lockedByName} on{" "}
          {lock.lockedAt.slice(0, 10)}. Figures are read-only until an
          administrator unlocks the period on the Data page.
        </div>
      )}

      <Card className="overflow-hidden p-0 shadow-xs">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 bg-surface-2/30 px-4 pb-2 pt-3.5">
          <div className="text-sm font-bold text-ink">
            Recurring Sales Projections —{" "}
            <span className="font-extrabold text-brand">{monthLabel}</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-surface p-3">
          <MonthSelect
            value={period}
            onChange={setPeriod}
            ariaLabel="Worksheet month"
            className="w-[140px]"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer / product…"
            className="w-56 text-xs"
          />
          {principals.length > 0 && (
            <Select
              value={principalId}
              onChange={(e) => setPrincipalId(e.target.value)}
              className="w-44 text-xs"
            >
              <option value="ALL">All principals</option>
              {principals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", "All"],
                ["projected", "Projected"],
                ["blank", "Unprojected"],
                ["due", "Needs follow-up"],
              ] as [LineFilter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setLineFilter(id)}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                  lineFilter === id
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="ml-auto"
          >
            <RefreshCw
              className={cn("mr-1 h-3.5 w-3.5", isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        </div>

        {/* Table */}
        <div className="max-h-[64vh] overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted whitespace-nowrap">
              <tr>
                <th className="w-10 px-3 py-2.5">#</th>
                <th className="min-w-[200px] px-3 py-2.5">Customer</th>
                {showSalesperson && (
                  <th className="min-w-[120px] px-3 py-2.5">Salesperson</th>
                )}
                <th className="min-w-[120px] px-3 py-2.5">Principal</th>
                <th className="min-w-[160px] px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5 text-right">Price (₹)</th>
                <th className="px-3 py-2.5 text-right">Proj Qty</th>
                <th className="px-3 py-2.5 text-right">Proj Value</th>
                <th className="px-3 py-2.5 text-right">Ach Qty</th>
                <th className="px-3 py-2.5 text-right text-brand">Ach Value</th>
                <th className="px-3 py-2.5 text-right">Ach %</th>
                <th className="min-w-[150px] px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {isLoading ? (
                <tr>
                  <td colSpan={colCount} className="py-16 text-center text-xs text-muted">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Loading projections…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={colCount} className="py-16 text-center text-xs text-red">
                    {error instanceof ApiError
                      ? `${error.status} — ${error.message}`
                      : "Failed to load projections."}
                  </td>
                </tr>
              ) : lines.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-16 text-center text-xs text-muted">
                    No projection lines for this period / filter.
                  </td>
                </tr>
              ) : (
                lines.map((l, i) => (
                  <tr key={l.id} className="group hover:bg-surface-2/70">
                    <td className="px-3 py-2 text-[11px] font-medium text-muted">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <span className="block font-bold text-ink">
                        {l.customerName}
                      </span>
                      {l.contactName && (
                        <span className="block text-[11px] text-muted">
                          ({l.contactName})
                          {l.tier ? ` · ${l.tier}` : ""}
                        </span>
                      )}
                    </td>
                    {showSalesperson && (
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                        {l.salespersonName}
                      </td>
                    )}
                    <td className="px-3 py-2 text-xs font-semibold text-ink">
                      {l.principalName}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink">{l.productName}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">
                      {l.price}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold whitespace-nowrap">
                      {l.committedQty || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-ink whitespace-nowrap">
                      {l.projValue > 0 ? inr(l.projValue) : "—"}
                    </td>
                    {/* Inline-editable achieved qty → PATCH */}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <input
                        type="number"
                        defaultValue={l.achievedQty || ""}
                        placeholder="0"
                        disabled={isLocked}
                        onBlur={(e) => {
                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                          if (val !== l.achievedQty)
                            patchCell(l.id, { achievedQty: val });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            (e.target as HTMLInputElement).blur();
                        }}
                        className="w-16 rounded-md border border-line bg-surface px-1.5 py-1 text-right text-xs font-bold tabular-nums text-brand focus:border-brand focus:outline-brand"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-brand whitespace-nowrap">
                      {l.achValue > 0 ? inr(l.achValue) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold whitespace-nowrap">
                      {l.achPct != null ? (
                        <span
                          className={cn(
                            l.achPct >= 100
                              ? "text-brand"
                              : l.achPct >= 50
                                ? "text-amber"
                                : "text-red",
                          )}
                        >
                          {l.achPct.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    {/* Inline-editable status → PATCH */}
                    <td className="px-3 py-2">
                      <select
                        value={l.status}
                        disabled={isLocked}
                        onChange={(e) =>
                          patchCell(l.id, {
                            status: e.target.value as ProjStatusValue,
                          })
                        }
                        className={cn(
                          "max-w-[160px] rounded-lg border px-2 py-1 text-xs font-semibold cursor-pointer",
                          l.status === "Confirmed" || l.status === "Completed"
                            ? "border-brand/40 bg-brand-soft text-brand-ink"
                            : l.status === "Lost" || l.status === "Cancelled"
                              ? "border-red/30 bg-red/10 text-red"
                              : l.status === "PartiallyConfirmed"
                                ? "border-amber/40 bg-amber/10 text-amber-700"
                                : l.status === "POReceived" || l.status === "OrderPlaced"
                                  ? "border-sky-400/40 bg-sky-50 text-sky-700"
                                  : l.status === "DeferredToNextMonth"
                                    ? "border-slate-300 bg-slate-100 text-slate-500"
                                    : "border-line bg-surface text-ink",
                        )}
                      >
                        {PROJ_STATUS_VALUES.map((st) => (
                          <option key={st} value={st}>
                            {PROJ_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 p-3 text-xs font-medium text-muted">
          <div>
            Showing <b className="text-ink">{summary?.totLines ?? 0}</b> lines ·
            Committed{" "}
            <b className="text-ink">{inr(summary?.totCommitted ?? 0)}</b> ·
            Achieved{" "}
            <b className="text-brand">{inr(summary?.totAchieved ?? 0)}</b> ·
            Achievement{" "}
            <b className="text-ink">
              {summary?.totPct != null ? `${summary.totPct.toFixed(1)}%` : "—"}
            </b>
          </div>
          {update.isPending && (
            <span className="flex items-center gap-1 text-brand">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          {update.isError && (
            <span className="text-red">
              {update.error instanceof ApiError
                ? update.error.message
                : "Save failed"}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
