import { Fragment, useState } from "react";
import {
  CalendarClock,
  CopyPlus,
  Download,
  FilePlus,
  Loader2,
  MessageSquare,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { periodLabel } from "@/data/months";
import { MonthSelect } from "@/components/MonthSelect";
import { useMonth, useUi } from "@/store/ui";
import { usePeriodLock } from "@/features/data/periodQueries";
import { useAuth, useAuthRole } from "@/store/auth";
import {
  useDeleteProjection,
  useProjections,
  useRollForward,
  useUpdateProjection,
  type ProjectionParams,
} from "@/features/projections/queries";
import {
  PROJ_STATUS_LABELS,
  PROJ_STATUS_VALUES,
  projStatusFromLabel,
  type ProjectionLine,
  type ProjStatusValue,
} from "@/features/projections/types";
import { ProjectionFollowUpModal } from "@/features/projections/ProjectionFollowUpModal";
import { ProjectionDateModal } from "@/features/projections/ProjectionDateModal";
import { ProjectionRemarksModal } from "@/features/projections/ProjectionRemarksModal";
import { CustomerDrawer } from "@/features/customers/CustomerDrawer";
import { AddCustomerModal } from "@/features/customers/AddCustomerModal";
import { CreateSalesOrderModal } from "@/features/orders/CreateSalesOrderModal";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/features/orders/types";
import { StatusBadge } from "@/components/StatusBadge";
import { todayIso } from "@/data/periodRange";
import { inr, longDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Card, Input } from "@/components/ui";
import { DeleteAction } from "@/components/modals/DeleteAction";

import { ApiError } from "@/lib/api";
import { toast } from "@/store/toastStore";

type LineFilter = ProjectionParams["lineFilter"];

/**
 * Statuses from which a line may be turned into a sales order.
 *
 * The POC's rule, and the right one: an order is raised once the customer has
 * actually committed. Offering it on a line still at "Projection Created"
 * invites an order for business nobody has agreed to.
 */
const CONVERTIBLE = new Set<ProjStatusValue>(["Confirmed", "PartiallyConfirmed"]);

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
  // The principal comes from the topbar, like it does on customers, leads,
  // orders and products. This page declares `principal` among its global
  // filters, so that control is drawn on it — and it used to be read by
  // nothing, while a SECOND principal select sat in the toolbar below it. Two
  // controls for one filter, and the one the user reaches for first was inert.
  const principalId = useUi((s) => s.principalId);
  const accessToken = useAuth((s) => s.accessToken);
  const role = useAuthRole();
  const showSalesperson = role !== "sales";

  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");
  const [followUpLine, setFollowUpLine] = useState<ProjectionLine | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [orderLine, setOrderLine] = useState<ProjectionLine | null>(null);
  const [remarksLine, setRemarksLine] = useState<ProjectionLine | null>(null);
  // Which date is being edited, and on which line. One modal serves both
  // columns; the field says which.
  const [dateEdit, setDateEdit] = useState<{
    line: ProjectionLine;
    field: "nextFollowUp" | "targetDate";
  } | null>(null);
  // The account drawer, the same one My Customers opens. A worksheet row names
  // a customer and gave no way to see who they are, what they owe or what has
  // been said to them — all of which is what decides the number being typed
  // into the row.
  const [drawerCustomerId, setDrawerCustomerId] = useState<string | null>(null);

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
  const rollForward = useRollForward();
  const removeLine = useDeleteProjection();

  const monthLabel = periodLabel(period);
  const lines = data?.lines ?? [];
  const summary = data?.summary;

  // A locked month is read-only. The server is the enforcement — it refuses the
  // PATCH for every role — and this is what stops the user finding that out by
  // typing a number and watching it bounce back with an error.
  const lock = usePeriodLock(period);
  const isLocked = !!lock;
  // Management reads the workspace rather than editing it, and the API refuses
  // its PATCH with a 403. Leaving the cells live meant the only way to learn
  // that was to type a number and watch it bounce — the same thing the lock
  // banner below exists to prevent.
  const isReadOnly = isLocked || role === "mgmt";
  // Same rule as typing into a cell: a role that may edit the worksheet may
  // start the month it goes in, and a locked month is frozen for everyone.
  const canRoll = !isReadOnly && lineFilter === "all" && !search.trim();
  // The remove column is only drawn where it can be used, so the empty-state
  // cell has to span one fewer when it is not.
  // 16 base columns (#, customer, principal, product, price, proj qty, proj
  // value, ach qty, ach value, ach %, next follow-up, expected closure, status,
  // remarks, follow-up log, sales order), +1 for the salesperson column, +1 for
  // the remove column.
  const colCount = 16 + (showSalesperson ? 1 : 0) + (isReadOnly ? 0 : 1);

  const patchCell = (id: string, patch: Parameters<typeof update.mutate>[0]["patch"]) =>
    update.mutate({ id, patch });

  /**
   * The month as a spreadsheet, from exactly what is on screen — the filtered,
   * sorted lines and the server's own figures. Nothing is recomputed here: a
   * CSV that disagrees with the table it was exported from is worse than none.
   */
  const exportCsv = () => {
    const header = [
      "#",
      "Customer",
      "Contact",
      "Tier",
      "Salesperson",
      "Principal",
      "Product",
      "Price",
      "Proj Qty",
      "Proj Value",
      "Ach Qty",
      "Ach Value",
      "Ach %",
      "Next follow-up",
      "Expected closure",
      "Status",
      "Sales order",
    ];
    const rows = lines.map((l, i) => [
      i + 1,
      l.customerName,
      l.contactName ?? "",
      l.tier ?? "",
      l.salespersonName,
      l.principalName,
      l.productName,
      l.price,
      l.committedQty,
      l.projValue,
      l.achievedQty,
      l.achValue,
      l.achPct == null ? "" : l.achPct.toFixed(1),
      l.nextFollowUp ?? "",
      l.targetDate ?? "",
      PROJ_STATUS_LABELS[l.status] ?? l.status,
      l.salesOrderStatus ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `projections_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          {/* The worksheet had no way to put a new account on it. Mapping a
              product from the customers page creates a line nobody can see,
              because a line exists per (mapping, month) and nothing opened one
              — so the button lives here, and passes the month in view. */}
          {!isReadOnly && (
            <Button
              size="sm"
              onClick={() => setShowAddCustomer(true)}
              className="ml-auto"
            >
              <UserPlus className="mr-1 h-3.5 w-3.5" />
              Add customer
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={lines.length === 0}
            className={cn(isReadOnly && "ml-auto")}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
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
                {/* The "Needs follow-up" filter above sorts on this date, and
                    the worksheet used to neither show it nor offer any way to
                    set it: the pill could empty the table and nothing on screen
                    said why, or what to change. */}
                <th className="min-w-[130px] px-3 py-2.5">Next follow-up</th>
                {/* `targetDate` — when the line is expected to close. It has
                    been on the record and in the PATCH contract all along with
                    no column to show it and no way to set it. */}
                <th className="min-w-[130px] px-3 py-2.5">Expected closure</th>
                <th className="min-w-[150px] px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Remarks</th>
                <th className="min-w-[120px] px-3 py-2.5">Follow-up log</th>
                <th className="min-w-[120px] px-3 py-2.5">Sales order</th>
                {!isReadOnly && <th className="px-3 py-2.5"></th>}
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
                    {/* A month with nothing in it used to be the end of the
                        road: there is no other way to put a line into one, so
                        every month after the imported one stayed permanently
                        empty and nobody could commit to it. */}
                    {canRoll && (
                      <div className="mt-4 space-y-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            rollForward.mutate(
                              { to: period, ownerId: ownerFilter === "ALL" ? undefined : ownerFilter },
                              {
                                onSuccess: (r) =>
                                  toast.success(
                                    r.created > 0
                                      ? `Carried ${r.created} line${r.created === 1 ? "" : "s"} from ${periodLabel(r.from)}`
                                      : `Nothing to carry from ${periodLabel(r.from)}`,
                                  ),
                                onError: (e) =>
                                  toast.error(
                                    e instanceof ApiError ? e.message : "Could not open the month",
                                  ),
                              },
                            )
                          }
                          disabled={rollForward.isPending}
                        >
                          {rollForward.isPending ? (
                            <>
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Opening…
                            </>
                          ) : (
                            <>
                              <CopyPlus className="mr-1 h-3.5 w-3.5" /> Roll forward into{" "}
                              {monthLabel}
                            </>
                          )}
                        </Button>
                        <div className="text-2xs text-muted">
                          Carries last month's committed quantities. Achievement, status and
                          follow-ups start clean, and a line already here is left alone.
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                lines.map((l, i) => (
                  <Fragment key={l.id}>
                    {/* The worksheet is sorted Platinum → Gold → Silver → Brass
                        → untiered, and that order was invisible: a band row is
                        what turns "sorted by tier" into something a reader can
                        see, and it is how the POC reads. */}
                    {(i === 0 || lines[i - 1].tier !== l.tier) && (
                      <tr className="bg-surface-2/80">
                        <td
                          colSpan={colCount}
                          className="px-3 py-1 text-3xs font-extrabold uppercase tracking-wider text-muted"
                        >
                          {l.tier || "Unclassified"}
                        </td>
                      </tr>
                    )}
                  <tr className="group hover:bg-surface-2/70">
                    <td className="px-3 py-2 text-[11px] font-medium text-muted">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setDrawerCustomerId(l.customerId)}
                        title={l.customerName}
                        className="block max-w-[220px] truncate text-left font-bold text-ink hover:text-brand hover:underline cursor-pointer"
                      >
                        {l.customerName}
                      </button>
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
                    <td className="px-3 py-2 text-xs text-ink">
                      <span
                        className="block max-w-[240px] truncate"
                        title={l.productName}
                      >
                        {l.productName}
                      </span>
                    </td>
                    {/* Price, editable. The input holds the line's OWN price
                        and shows the agreed/catalog price as its placeholder,
                        so clearing the field hands the line back to the mapping
                        rather than freezing today's figure onto it. */}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isReadOnly ? (
                        <span className="tabular-nums font-semibold">{l.price}</span>
                      ) : (
                        <input
                          key={`price-${l.id}-${l.ownPrice ?? "i"}`}
                          type="number"
                          step="0.01"
                          min="0"
                          aria-label={`Price for ${l.customerName} ${l.productName}`}
                          defaultValue={l.ownPrice ?? ""}
                          placeholder={
                            l.inheritedPrice != null ? String(l.inheritedPrice) : "0"
                          }
                          onBlur={(e) => {
                            const raw = e.target.value.trim();
                            const next = raw === "" ? null : Number(raw);
                            if (next != null && (isNaN(next) || next < 0)) {
                              e.target.value = l.ownPrice == null ? "" : String(l.ownPrice);
                              return;
                            }
                            if (next !== l.ownPrice) patchCell(l.id, { price: next });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              (e.target as HTMLInputElement).blur();
                          }}
                          className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-right text-xs tabular-nums font-semibold text-ink focus:border-brand focus:outline-none"
                        />
                      )}
                    </td>
                    {/* Proj Qty — the committed quantity, and the one number this
                        whole worksheet exists to collect. It was read-only: the
                        page could show a commitment but not take one, so the
                        only rows with a quantity were the ones the import or a
                        roll-forward had carried in. */}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isReadOnly ? (
                        <span className="tabular-nums font-bold">
                          {l.committedQty || "—"}
                        </span>
                      ) : (
                        <input
                          key={`qty-${l.id}-${l.committedQty}`}
                          type="number"
                          min="0"
                          aria-label={`Projected quantity for ${l.customerName} ${l.productName}`}
                          defaultValue={l.committedQty || ""}
                          placeholder="0"
                          onBlur={(e) => {
                            const raw = e.target.value.trim();
                            const next = raw === "" ? 0 : Number(raw);
                            if (isNaN(next) || next < 0) {
                              e.target.value = l.committedQty ? String(l.committedQty) : "";
                              return;
                            }
                            if (next !== l.committedQty)
                              patchCell(l.id, { committedQty: next });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              (e.target as HTMLInputElement).blur();
                          }}
                          className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-right text-xs tabular-nums font-bold text-ink focus:border-brand focus:outline-none"
                        />
                      )}
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
                        disabled={isReadOnly}
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
                    {/* Editable from the row, like the POC — the cell opens the
                        date picker for this line rather than a form about
                        something else. Overdue reads red. */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => setDateEdit({ line: l, field: "nextFollowUp" })}
                        className={cn(
                          "rounded-md border px-1.5 py-1 text-xs tabular-nums",
                          isReadOnly
                            ? "cursor-default border-transparent text-muted"
                            : "cursor-pointer border-line bg-surface text-ink hover:border-brand hover:text-brand",
                          l.nextFollowUp && l.nextFollowUp <= todayIso() && "font-bold text-red",
                        )}
                      >
                        {longDate(l.nextFollowUp)}
                      </button>
                    </td>
                    {/* Expected closure. Set in the same modal as the follow-up
                        date, because a date is entered here as day / month /
                        year dropdowns rather than typed into a cell. */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => setDateEdit({ line: l, field: "targetDate" })}
                        className={cn(
                          "rounded-md border px-1.5 py-1 text-xs tabular-nums",
                          isReadOnly
                            ? "cursor-default border-transparent text-muted"
                            : "cursor-pointer border-line bg-surface text-ink hover:border-brand hover:text-brand",
                        )}
                      >
                        {longDate(l.targetDate)}
                      </button>
                    </td>
                    {/* Inline-editable status → PATCH */}
                    <td className="px-3 py-2">
                      <select
                        value={l.status}
                        disabled={isReadOnly}
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
                    {/* Remarks and Follow-up log, each with what it holds on it
                        — the POC's pair. Before this the notes were reachable
                        only inside the follow-up form and the count was
                        nowhere, so which lines had been worked was invisible. */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setRemarksLine(l)}
                        className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-1 text-2xs font-semibold text-ink hover:border-brand hover:text-brand cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Remarks
                        {l.remarkCount > 0 && (
                          <span className="rounded-full bg-brand px-1.5 text-3xs font-bold text-white tabular-nums">
                            {l.remarkCount}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => setFollowUpLine(l)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-2xs font-semibold",
                          isReadOnly
                            ? "cursor-default border-transparent text-muted"
                            : "cursor-pointer border-line bg-surface text-ink hover:border-brand hover:text-brand",
                        )}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {/* "Next 10-02" when one is set, so the button says what
                            it holds rather than only what it does. */}
                        {l.nextFollowUp ? `Next ${l.nextFollowUp.slice(5)}` : "Log follow-up"}
                        {l.followUpCount > 0 && (
                          <span className="rounded-full bg-brand px-1.5 text-3xs font-bold text-white tabular-nums">
                            {l.followUpCount}
                          </span>
                        )}
                      </button>
                    </td>
                    {/* The commitment becoming an order. `Projection.salesOrderId`
                        was in the schema from the start and nothing ever wrote
                        it, so "Order Placed" was a label with no order behind
                        it — POST /orders now takes the line and links it. */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {l.salesOrderId ? (
                        <StatusBadge
                          label={
                            ORDER_STATUS_LABELS[l.salesOrderStatus as OrderStatusValue] ??
                            l.salesOrderStatus ??
                            "Ordered"
                          }
                          tone="won"
                        />
                      ) : CONVERTIBLE.has(l.status) && !isReadOnly ? (
                        <Button size="xs" variant="outline" onClick={() => setOrderLine(l)}>
                          <FilePlus className="mr-1 h-3.5 w-3.5" />
                          Create SO
                        </Button>
                      ) : (
                        <span className="text-2xs text-muted">—</span>
                      )}
                    </td>
                    {/* A rolled-forward month carries every commitment the last
                        one held, including customers who have since stopped
                        buying. Without a way out, the only way to take one off
                        the total is to commit zero and pretend. */}
                    {!isReadOnly && (
                      <td className="px-3 py-2 text-right">
                        <DeleteAction
                          label="Remove"
                          title={`Remove ${l.customerName} · ${l.productName}?`}
                          body={
                            <>
                              This line leaves {monthLabel} and its{" "}
                              {inr(l.projValue)} comes off the month's commitment.
                              Other months are untouched.
                            </>
                          }
                          onDelete={() => removeLine.mutateAsync(l.id)}
                          className="text-xs"
                        />
                      </td>
                    )}
                  </tr>
                  </Fragment>
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

      {/* The same log the dashboard opens on a line, so a follow-up is set the
          one way wherever it is reached from. */}
      {followUpLine && (
        <ProjectionFollowUpModal
          open
          onClose={() => setFollowUpLine(null)}
          title={`${followUpLine.customerName} · ${followUpLine.productName}`}
          subtitle={`${followUpLine.principalName} · Proj ${followUpLine.committedQty || 0} units @ ₹${followUpLine.price || 0} = ${inr(followUpLine.projValue || 0)} · Achieved ${followUpLine.achievedQty || 0}`}
          currentDate={followUpLine.nextFollowUp}
          currentTargetDate={followUpLine.targetDate}
          currentProb={followUpLine.probability ?? undefined}
          currentStatus={PROJ_STATUS_LABELS[followUpLine.status] ?? followUpLine.status}
          projectionId={followUpLine.id}
          onSave={(nextDate, _note, prob, nextStatusLabel, targetDate) => {
            const rawStatus = projStatusFromLabel(nextStatusLabel);
            update.mutate({
              id: followUpLine.id,
              patch: {
                nextFollowUp: nextDate,
                targetDate: targetDate ?? null,
                probability: prob ?? null,
                ...(rawStatus ? { status: rawStatus } : {}),
              },
            });
          }}
        />
      )}

      {/* `period` is what makes this useful from here: the account's mapped
          products get a blank line in the month on screen, so the customer is
          on the worksheet the moment the form closes. `requireMapping`, because
          an account with nothing mapped cannot appear on it at all. */}
      <AddCustomerModal
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        period={period}
        requireMapping
      />

      {remarksLine && (
        <ProjectionRemarksModal
          open
          onClose={() => setRemarksLine(null)}
          title="Activity notes"
          subtitle={`${remarksLine.customerName} · ${remarksLine.productName}`}
          projectionId={remarksLine.id}
          canWrite={!isReadOnly}
        />
      )}

      {dateEdit && (
        <ProjectionDateModal
          open
          onClose={() => setDateEdit(null)}
          title={
            dateEdit.field === "nextFollowUp" ? "Next follow-up" : "Expected closure"
          }
          subtitle={`${dateEdit.line.customerName} · ${dateEdit.line.productName}`}
          fieldLabel={
            dateEdit.field === "nextFollowUp"
              ? "Next follow-up date"
              : "Expected closure date"
          }
          value={
            dateEdit.field === "nextFollowUp"
              ? dateEdit.line.nextFollowUp
              : dateEdit.line.targetDate
          }
          onSave={(next) => patchCell(dateEdit.line.id, { [dateEdit.field]: next })}
        />
      )}

      {/* The same account drawer My Customers opens, from the customer name. */}
      <CustomerDrawer
        customerId={drawerCustomerId}
        onClose={() => setDrawerCustomerId(null)}
      />

      {/* Pre-filled from the line and carrying its id, so the order that comes
          back is linked to the commitment it came from rather than being a
          separate record that happens to name the same customer. */}
      {orderLine && (
        <CreateSalesOrderModal
          open
          onClose={() => setOrderLine(null)}
          initialCustomerId={orderLine.customerId}
          initialProductId={orderLine.productId}
          initialQty={orderLine.committedQty || 1}
          initialPrice={orderLine.price}
          fromProjectionId={orderLine.id}
        />
      )}
    </div>
  );
}
