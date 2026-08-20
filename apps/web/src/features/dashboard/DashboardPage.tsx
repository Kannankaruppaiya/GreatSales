import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Plus,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { MONTHS, projTone } from "@/data/constants";
import { useUi } from "@/store/ui";
import { useAuth, useAuthRole } from "@/store/auth";
import { inr, lakhs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { CompareLegend, GroupedBars } from "@/components/charts";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { LeadDetailModal } from "@/features/leads/LeadDetailModal";
import { ProjectionFollowUpModal } from "@/features/projections/ProjectionFollowUpModal";
import { CustomerDrawer } from "@/features/customers/CustomerDrawer";
import { AddLeadModal } from "@/features/leads/AddLeadModal";
import { AddCustomerModal } from "@/features/customers/AddCustomerModal";
import { CreateSalesOrderModal } from "@/features/orders/CreateSalesOrderModal";
import { toast } from "@/store/toastStore";
import { useProjections, useUpdateProjection } from "@/features/projections/queries";
import {
  PROJ_STATUS_LABELS,
  projStatusFromLabel,
  type ProjectionLine,
} from "@/features/projections/types";
import { useLeads, flattenLeads } from "@/features/leads/queries";
import type { LeadRow } from "@/features/leads/types";

/** Non-final new-sales pipeline stages that still count toward "committed"
 * (everything except the two dead-end closures). Raw DealStageValue strings. */
const NEW_SALES_DEAD_STAGES = ["ClosedLost", "NoRequirementOrCold"];
/** Recurring projection statuses that are done — excluded from follow-up due/overdue counts. */
const CLOSED_PROJ_STATUSES = ["Confirmed", "Completed", "Lost", "Cancelled"];
/** New-sales stages that are done — excluded from follow-up due/overdue counts. */
const CLOSED_LEAD_STAGES = ["ClosedWon", "ClosedLost", "NoRequirementOrCold"];

/** Small inline skeleton for a KPI value that is still waiting on the
 * fetch-all leads query (see `leadsLoadingFull` below) while the rest of the
 * grid (gated on the primary projections query) is already visible. */
function KpiSkeleton() {
  return <span className="inline-block h-5 w-14 animate-pulse rounded bg-surface-2 align-middle" />;
}

export default function DashboardPage() {
  const { month } = useUi();
  const role = useAuthRole();
  const accessToken = useAuth((s) => s.accessToken);
  const enabled = !!accessToken;

  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [selectedFuProj, setSelectedFuProj] = useState<ProjectionLine | null>(null);
  const [selectedDrawerCustId, setSelectedDrawerCustId] = useState<string | null>(null);

  // Quick action modal states
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);

  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? month;
  const isSalesRole = role === "sales";
  const todayStr = new Date().toISOString().slice(0, 10);

  // Recurring projections for the selected period. RLS already scopes a
  // sales-role session to its own rows server-side, so unlike the old mock
  // store there is no client-side ownerId filter here — see the report for
  // why the global principal/owner Topbar filters (still mock-id-based)
  // aren't wired in either.
  const projQuery = useProjections({ period: month }, enabled);
  const updateProjection = useUpdateProjection();
  const projLines = useMemo(() => projQuery.data?.lines ?? [], [projQuery.data]);
  const summary = projQuery.data?.summary;

  // New-sales leads (not period-scoped, matching the old mock behavior).
  // Fetch every page before aggregating KPIs — same "fetch-all" pattern as
  // PaymentsPage.tsx/LeadsPage.tsx: a single page of 50 would misreport
  // "New sales committed" / "Total committed" / follow-up counts.
  const leadsQuery = useLeads({}, { enabled });
  useEffect(() => {
    if (leadsQuery.hasNextPage && !leadsQuery.isFetchingNextPage) {
      leadsQuery.fetchNextPage();
    }
  }, [leadsQuery.hasNextPage, leadsQuery.isFetchingNextPage, leadsQuery.fetchNextPage]);
  const leadRows = flattenLeads(leadsQuery.data);
  const leadsLoadingFull = leadsQuery.isLoading || leadsQuery.hasNextPage === true;

  // Salesperson / industry FK options for AddLeadModal — no dedicated
  // endpoint, derived from loaded rows only (same pattern as LeadsPage.tsx).
  const salespersonOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leadRows) if (l.salespersonId) m.set(l.salespersonId, l.salespersonName || l.salespersonId);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [leadRows]);
  const industryOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leadRows) if (l.industryId && l.industryName) m.set(l.industryId, l.industryName);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [leadRows]);

  // KPI calculations — recurring figures are rendered straight from the
  // server-computed summary (never recomputed from line items); new-sales
  // figures sum each lead's server-computed totalValue.
  const recurringCommitted = summary?.totCommitted ?? 0;
  const recurringAchieved = summary?.totAchieved ?? 0;
  const recPct = summary?.totPct ?? null;

  const newSalesCommitted = leadRows
    .filter((l) => !NEW_SALES_DEAD_STAGES.includes(l.stage))
    .reduce((s, l) => s + (l.totalValue || 0), 0);
  const newSalesAchieved = leadRows
    .filter((l) => l.stage === "ClosedWon")
    .reduce((s, l) => s + (l.totalValue || 0), 0);

  const totalCommitted = recurringCommitted + newSalesCommitted;
  const totalAchieved = recurringAchieved + newSalesAchieved;
  const totalPct = totalCommitted > 0 ? (totalAchieved / totalCommitted) * 100 : null;

  let fuDue = 0;
  let fuOverdue = 0;
  projLines.forEach((p) => {
    if (!CLOSED_PROJ_STATUSES.includes(p.status) && p.nextFollowUp) {
      if (p.nextFollowUp < todayStr) fuOverdue++;
      else if (p.nextFollowUp === todayStr) fuDue++;
    }
  });
  leadRows.forEach((l) => {
    if (!CLOSED_LEAD_STAGES.includes(l.stage) && l.nextFollowUp) {
      if (l.nextFollowUp < todayStr) fuOverdue++;
      else if (l.nextFollowUp === todayStr) fuDue++;
    }
  });

  // Salesperson bar chart data (Admin/Mgmt view) — union of everyone who
  // appears as a salesperson on either a loaded projection line or lead (no
  // dedicated "list sales users" endpoint is composed into this page).
  const spChartItems = useMemo(() => {
    const sp = new Map<string, string>();
    projLines.forEach((p) => sp.set(p.salespersonId, p.salespersonName));
    leadRows.forEach((l) => sp.set(l.salespersonId, l.salespersonName));

    return [...sp.entries()].map(([id, label]) => {
      const spProjs = projLines.filter((p) => p.salespersonId === id);
      const spLeads = leadRows.filter((l) => l.salespersonId === id);

      const cVal =
        spProjs.reduce((s, p) => s + (p.projValue || 0), 0) +
        spLeads
          .filter((l) => !NEW_SALES_DEAD_STAGES.includes(l.stage))
          .reduce((s, l) => s + (l.totalValue || 0), 0);

      const aVal =
        spProjs.reduce((s, p) => s + (p.achValue || 0), 0) +
        spLeads
          .filter((l) => l.stage === "ClosedWon")
          .reduce((s, l) => s + (l.totalValue || 0), 0);

      return { label, committed: cVal, achieved: aVal };
    });
  }, [projLines, leadRows]);

  // Oral Confirmation Deals
  const oralDeals = useMemo(
    () => leadRows.filter((l) => l.stage === "NegotiationOralConfirmation"),
    [leadRows],
  );

  // Top Open Projections (for sales view)
  const topOpenProjections = useMemo(() => {
    return projLines
      .filter((p) => p.committedQty > 0 && !CLOSED_PROJ_STATUSES.includes(p.status))
      .sort((a, b) => b.projValue - a.projValue)
      .slice(0, 10);
  }, [projLines]);

  // Principal performance bars (Admin / Mgmt view) — derived directly from
  // each line's embedded principalId/principalName (no separate principal
  // master list is composed into this page).
  const principalStats = useMemo(() => {
    const map = new Map<string, { name: string; committed: number; achieved: number }>();
    projLines.forEach((p) => {
      const cur = map.get(p.principalId) ?? { name: p.principalName, committed: 0, achieved: 0 };
      cur.committed += p.projValue || 0;
      cur.achieved += p.achValue || 0;
      map.set(p.principalId, cur);
    });
    return [...map.values()]
      .filter((pr) => pr.committed > 0 || pr.achieved > 0)
      .sort((a, b) => b.committed - a.committed);
  }, [projLines]);

  // Customer category mix (Admin / Mgmt view)
  const categoryStats = useMemo(() => {
    const tiers = ["Platinum", "Gold", "Silver", "Brass"];
    const map: Record<string, { committed: number; achieved: number }> = {};
    tiers.forEach((t) => (map[t] = { committed: 0, achieved: 0 }));

    projLines.forEach((p) => {
      const t = p.tier || "Silver";
      if (map[t]) {
        map[t].committed += p.projValue || 0;
        map[t].achieved += p.achValue || 0;
      }
    });

    return tiers.map((t) => ({ tier: t, ...map[t] }));
  }, [projLines]);

  return (
    <div className="space-y-5">
      {/* Enterprise Executive Banner with Quick Actions */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-surface via-surface to-brand-soft/30 p-5 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand text-white shadow-2xs">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-brand-ink">
              Commercial Sales Pulse · {monthLabel}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-sans">
            Revenue Performance & Pipeline Tracker
          </h1>
          <p className="text-xs text-muted">
            Track commitments, actual realizations, hot deals, and overdue credit collections in real time.
          </p>
        </div>

        {role !== "mgmt" && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={() => setShowAddLead(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Sales Lead
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowAddCustomer(true)}>
              <Building2 className="h-3.5 w-3.5 mr-1" /> Add Customer
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreateOrder(true)}>
              <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Create Order
            </Button>
          </div>
        )}
      </div>

      <QueryBoundary
        isLoading={projQuery.isLoading}
        isError={projQuery.isError}
        error={projQuery.error}
      >
        <div className="space-y-5">
          {/* 6 Top KPI Cards with Visual Depth */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs hover:border-muted transition-colors">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Recurring committed</div>
              <div className="text-xl font-black text-ink mt-1 tabular-nums">{lakhs(recurringCommitted)}</div>
              <div className="text-xs text-muted mt-0.5">Achieved: {lakhs(recurringAchieved)}</div>
            </div>

            <div className="rounded-xl border border-brand/40 bg-brand-soft/70 p-3.5 shadow-xs">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-brand-ink">Recurring achieved</div>
              <div className="text-xl font-black text-brand-ink mt-1 tabular-nums">{lakhs(recurringAchieved)}</div>
              <div className="text-xs text-brand-ink/80 mt-0.5 font-semibold">
                {recPct != null ? `${recPct.toFixed(1)}% achieved` : "—"}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs hover:border-muted transition-colors">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">New sales committed</div>
              <div className="text-xl font-black text-ink mt-1 tabular-nums">
                {leadsLoadingFull ? <KpiSkeleton /> : lakhs(newSalesCommitted)}
              </div>
              <div className="text-xs text-muted mt-0.5">
                Won: {leadsLoadingFull ? "…" : lakhs(newSalesAchieved)}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs hover:border-muted transition-colors">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Total committed</div>
              <div className="text-xl font-black text-ink mt-1 tabular-nums">
                {leadsLoadingFull ? <KpiSkeleton /> : lakhs(totalCommitted)}
              </div>
              <div className="text-xs text-muted mt-0.5">Recurring + New sales</div>
            </div>

            <div className="rounded-xl border border-brand/40 bg-brand-soft/70 p-3.5 shadow-xs">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-brand-ink">Total achieved</div>
              <div className="text-xl font-black text-brand-ink mt-1 tabular-nums">
                {leadsLoadingFull ? <KpiSkeleton /> : lakhs(totalAchieved)}
              </div>
              <div className="text-xs text-brand-ink/80 mt-0.5 font-semibold">
                {leadsLoadingFull ? "…" : totalPct != null ? `${totalPct.toFixed(1)}% target` : "—"}
              </div>
            </div>

            <div className={cn("rounded-xl border p-3.5 shadow-xs transition-colors", fuOverdue > 0 ? "border-red/40 bg-red-soft/70" : "border-line bg-surface")}>
              <div className={cn("text-[10.5px] font-bold uppercase tracking-wider", fuOverdue > 0 ? "text-red" : "text-muted")}>
                Follow-ups due
              </div>
              <div className={cn("text-xl font-black mt-1 tabular-nums", fuOverdue > 0 ? "text-red" : "text-ink")}>
                {leadsLoadingFull ? <KpiSkeleton /> : fuDue + fuOverdue}
              </div>
              <div className={cn("text-xs mt-0.5 font-semibold", fuOverdue > 0 ? "text-red" : "text-muted")}>
                {leadsLoadingFull ? "…" : fuOverdue > 0 ? `${fuOverdue} overdue` : "All up to date"}
              </div>
            </div>
          </div>

          {isSalesRole ? (
            /* Sales Role Dashboard Views */
            <div className="space-y-5">
              {/* 1. Deals at Oral Confirmation */}
              <Card className="p-0 overflow-hidden shadow-xs border-line">
                <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/40">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink">My deals at Oral Confirmation</span>
                    <span className="rounded bg-brand-soft border border-brand/20 px-2 py-0.5 text-[10.5px] font-bold text-brand-ink">
                      High Probability
                    </span>
                  </div>
                  <span className="text-xs text-muted font-medium">{oralDeals.length} deals</span>
                </div>

                <QueryBoundary isLoading={leadsLoadingFull} isError={leadsQuery.isError} error={leadsQuery.error}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line">
                        <tr>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Contact</th>
                          <th className="py-2.5 px-3">Mobile</th>
                          <th className="py-2.5 px-3 text-right">Value</th>
                          <th className="py-2.5 px-3">Next follow-up</th>
                          <th className="py-2.5 px-3">Expected closure</th>
                          <th className="py-2.5 px-3 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {oralDeals.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-xs text-muted">
                              No deals currently at Oral Confirmation stage.
                            </td>
                          </tr>
                        ) : (
                          oralDeals.map((l) => (
                            <tr key={l.id} className="hover:bg-surface-2/60 transition-colors">
                              <td className="py-2.5 px-3">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLead(l)}
                                  className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left"
                                >
                                  {l.customerName}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-muted">{l.contactName || "—"}</td>
                              <td className="py-2.5 px-3 text-muted tabular-nums">{l.phone || "—"}</td>
                              <td className="py-2.5 px-3 text-right tabular-nums font-bold text-brand">
                                {inr(l.totalValue || 0)}
                              </td>
                              <td className="py-2.5 px-3 tabular-nums text-muted">{l.nextFollowUp || "—"}</td>
                              <td className="py-2.5 px-3 tabular-nums text-muted">{l.expClose || "—"}</td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLead(l)}
                                  className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:border-brand hover:text-brand cursor-pointer shadow-2xs transition-colors"
                                >
                                  Open Deal
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </QueryBoundary>
              </Card>

              {/* 2. Top open projections */}
              <Card className="p-0 overflow-hidden shadow-xs border-line">
                <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/40">
                  <div className="font-bold text-sm text-ink">Top open projections this month</div>
                  <span className="text-xs text-muted font-medium">{topOpenProjections.length} lines</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line">
                      <tr>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Principal</th>
                        <th className="py-2.5 px-3">Sub product</th>
                        <th className="py-2.5 px-3 text-right">Proj value</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Next follow-up</th>
                        <th className="py-2.5 px-3 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {topOpenProjections.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs text-muted">
                            No open projections for this month.
                          </td>
                        </tr>
                      ) : (
                        topOpenProjections.map((p) => (
                          <tr key={p.id} className="hover:bg-surface-2/60 transition-colors">
                            <td className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={() => setSelectedDrawerCustId(p.customerId)}
                                className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left"
                              >
                                {p.customerName}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-muted">{p.principalName}</td>
                            <td className="py-2.5 px-3 font-semibold text-ink">{p.productName}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink">
                              {p.projValue > 0 ? inr(p.projValue) : "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge
                                label={PROJ_STATUS_LABELS[p.status] ?? p.status}
                                tone={projTone(PROJ_STATUS_LABELS[p.status] ?? p.status)}
                              />
                            </td>
                            <td className="py-2.5 px-3 tabular-nums text-muted">{p.nextFollowUp || "—"}</td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedFuProj(p)}
                                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:border-brand hover:text-brand cursor-pointer shadow-2xs transition-colors"
                              >
                                Log Follow-Up
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : (
            /* Admin & Management Dashboard Views */
            <div className="space-y-5">
              {/* 1. Committed vs achieved by salesperson chart */}
              <Card className="p-4 shadow-xs border-line">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-sm text-ink">
                    Committed vs achieved by salesperson — {monthLabel}
                  </div>
                  <CompareLegend />
                </div>
                <QueryBoundary isLoading={leadsLoadingFull} isError={leadsQuery.isError} error={leadsQuery.error}>
                  <div className="pt-2">
                    <GroupedBars data={spChartItems} />
                  </div>
                </QueryBoundary>
              </Card>

              {/* 2. Deals at Oral Confirmation */}
              <Card className="p-0 overflow-hidden shadow-xs border-line">
                <div className="p-3.5 border-b border-line flex items-center justify-between bg-surface-2/40">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink">Deals at Oral Confirmation stage</span>
                    <span className="rounded bg-brand-soft border border-brand/20 px-2 py-0.5 text-[10.5px] font-bold text-brand-ink">
                      High Probability
                    </span>
                  </div>
                  <span className="text-xs text-muted font-medium">{oralDeals.length} deals</span>
                </div>

                <QueryBoundary isLoading={leadsLoadingFull} isError={leadsQuery.isError} error={leadsQuery.error}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line">
                        <tr>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Salesperson</th>
                          <th className="py-2.5 px-3 text-right">Value</th>
                          <th className="py-2.5 px-3">Expected closure</th>
                          <th className="py-2.5 px-3 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {oralDeals.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-xs text-muted">
                              No deals currently at Oral Confirmation stage.
                            </td>
                          </tr>
                        ) : (
                          oralDeals.map((l) => (
                            <tr key={l.id} className="hover:bg-surface-2/60 transition-colors">
                              <td className="py-2.5 px-3">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLead(l)}
                                  className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left"
                                >
                                  {l.customerName}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-muted">{l.salespersonName || "—"}</td>
                              <td className="py-2.5 px-3 text-right tabular-nums font-bold text-brand">
                                {inr(l.totalValue || 0)}
                              </td>
                              <td className="py-2.5 px-3 tabular-nums text-muted">{l.expClose || "—"}</td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLead(l)}
                                  className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:border-brand hover:text-brand cursor-pointer shadow-2xs transition-colors"
                                >
                                  Open Deal
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </QueryBoundary>
              </Card>

              {/* 3. Principal Performance & Category Mix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Principal Performance */}
                <Card className="p-4 shadow-xs border-line">
                  <div className="font-bold text-sm text-ink mb-3">Principal performance this month</div>
                  <div className="space-y-3">
                    {principalStats.slice(0, 6).map((pr) => {
                      const achPct = pr.committed > 0 ? (pr.achieved / pr.committed) * 100 : 0;
                      return (
                        <div key={pr.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-ink">{pr.name}</span>
                            <span className="text-muted tabular-nums">
                              {inr(pr.achieved)} / {inr(pr.committed)} ({achPct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                            <div
                              className="h-full bg-brand rounded-full transition-all"
                              style={{ width: `${Math.min(100, achPct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Customer Category Mix */}
                <Card className="p-4 shadow-xs border-line">
                  <div className="font-bold text-sm text-ink mb-3">Customer category mix</div>
                  <div className="space-y-3">
                    {categoryStats.map((c) => {
                      const achPct = c.committed > 0 ? (c.achieved / c.committed) * 100 : 0;
                      return (
                        <div key={c.tier} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-ink">{c.tier} Customers</span>
                            <span className="text-muted tabular-nums">
                              {inr(c.achieved)} / {inr(c.committed)} ({achPct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                            <div
                              className="h-full bg-brand rounded-full transition-all"
                              style={{ width: `${Math.min(100, achPct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </QueryBoundary>

      {/* Modals & Drawers */}
      {selectedLead && (
        <LeadDetailModal
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          lead={selectedLead}
        />
      )}

      {selectedFuProj && (
        <ProjectionFollowUpModal
          open={!!selectedFuProj}
          onClose={() => setSelectedFuProj(null)}
          title={`${selectedFuProj.customerName} · ${selectedFuProj.productName}`}
          subtitle={`${selectedFuProj.principalName} · Proj ${selectedFuProj.committedQty || 0} units @ ₹${selectedFuProj.price || 0} = ${inr(selectedFuProj.projValue || 0)} · Achieved ${selectedFuProj.achievedQty || 0} · Status: ${PROJ_STATUS_LABELS[selectedFuProj.status] ?? selectedFuProj.status}`}
          currentDate={selectedFuProj.nextFollowUp}
          currentProb={selectedFuProj.probability ?? undefined}
          currentStatus={PROJ_STATUS_LABELS[selectedFuProj.status] ?? selectedFuProj.status}
          remarks={[]}
          onSave={(nextDate, _note, prob, nextStatusLabel) => {
            const rawStatus = projStatusFromLabel(nextStatusLabel);
            updateProjection.mutate(
              {
                id: selectedFuProj.id,
                patch: {
                  nextFollowUp: nextDate,
                  probability: prob ?? null,
                  ...(rawStatus ? { status: rawStatus } : {}),
                },
              },
              {
                onSuccess: () => toast.success("Follow-up updated successfully"),
                onError: () => toast.error("Failed to update follow-up"),
              },
            );
          }}
        />
      )}

      <CustomerDrawer
        customerId={selectedDrawerCustId}
        onClose={() => setSelectedDrawerCustId(null)}
      />

      <AddLeadModal
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
        salespeople={salespersonOptions}
        industries={industryOptions}
      />
      <AddCustomerModal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />
      <CreateSalesOrderModal open={showCreateOrder} onClose={() => setShowCreateOrder(false)} />
    </div>
  );
}
