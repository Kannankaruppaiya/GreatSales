import { useState } from "react";
import {
  Building2,
  Plus,
  ShoppingCart,
  Target,
} from "lucide-react";
import { periodLabel } from "@/data/months";
import { usePeriodRange, useUi } from "@/store/ui";
import { useAuth, useAuthRole, useHasPermission } from "@/store/auth";
import { inr, lakhs, longDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { CompareLegend, GroupedBars } from "@/components/charts";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { LeadDetailModal } from "@/features/leads/LeadDetailModal";
import { AddLeadModal } from "@/features/leads/AddLeadModal";
import { AddCustomerModal } from "@/features/customers/AddCustomerModal";
import { CreateSalesOrderModal } from "@/features/orders/CreateSalesOrderModal";
import type { LeadRow } from "@/features/leads/types";
import { useDashboard } from "@/features/dashboard/queries";
import { SetTargetsModal } from "@/features/dashboard/SetTargetsModal";
import { FollowUpsDueModal } from "@/features/dashboard/FollowUpsDueModal";
import type { DashboardBreakdown } from "@/features/dashboard/types";

// The stage/status lists that used to live here moved to the server with the
// arithmetic they served (apps/api/src/dashboard/dashboard.service.ts). Keeping
// a copy would be keeping a second definition of "which deals count".

/** Small inline skeleton for a KPI value while the single aggregate request is
 * still in flight. Previously this covered a half-loaded page: the rest of the
 * grid (gated on the primary projections query) is already visible. */
function KpiSkeleton() {
  return <span className="inline-block h-5 w-14 animate-pulse rounded bg-surface-2 align-middle" />;
}

export default function DashboardPage() {
  const { ownerFilter } = useUi();
  const range = usePeriodRange();
  const role = useAuthRole();
  const accessToken = useAuth((s) => s.accessToken);
  const enabled = !!accessToken;
  const ownerId = ownerFilter === "ALL" ? undefined : ownerFilter;

  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);

  // Quick action modal states
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [showFollowUps, setShowFollowUps] = useState(false);
  // Presentation only — the API enforces the same key on PUT /targets.
  const canManageTargets = useHasPermission("target.manage");

  const windowLabel = range.label;
  /**
   * What the RECURRING half covers.
   *
   * A commitment is a month, so a day or a week resolves to the month
   * containing it — and the cards that show recurring figures say that month
   * rather than the window, because "₹0 recurring this Tuesday" would be a
   * sentence about nothing.
   */
  // A day or a week is SHORTER than the month the recurring figures cover, so
  // those two cards get the month spelled out. A month or a year window
  // already matches, and repeating it would be noise.
  const isSubMonth = range.granularity === "day" || range.granularity === "week";
  const recurringLabel = range.months
    .map(periodLabel)
    .join(range.months.length > 2 ? " … " : " and ");
  const isSalesRole = role === "sales";

  // ONE request for the whole page scoped by period and topbar salesperson filter.
  const dashQuery = useDashboard(range, { ownerId, enabled });

  const kpis = dashQuery.data?.kpis;
  const recurringCommitted = kpis?.recurringCommitted ?? 0;
  const recurringAchieved = kpis?.recurringAchieved ?? 0;
  const recPct = kpis?.recurringPct ?? null;
  const newSalesCommitted = kpis?.newSalesCommitted ?? 0;
  const newSalesAchieved = kpis?.newSalesAchieved ?? 0;
  const totalCommitted = kpis?.totalCommitted ?? 0;
  const totalAchieved = kpis?.totalAchieved ?? 0;
  const totalPct = kpis?.totalPct ?? null;
  // The month's target, as set by management. Null means nobody in scope has
  // one — which is a different thing from a target of zero, so it is not
  // defaulted here.
  const target = kpis?.target ?? null;
  const targetPct = kpis?.targetPct ?? null;
  // Resolved against the tenant's business day server-side — a browser clock
  // gave two users in different timezones different overdue counts.
  const fuDue = kpis?.followUpsDue ?? 0;
  const fuOverdue = kpis?.followUpsOverdue ?? 0;

  const spChartItems = (dashQuery.data?.bySalesperson ?? []).map((r: DashboardBreakdown) => ({
    label: r.name,
    committed: r.committed,
    achieved: r.achieved,
  }));
  const oralDeals = dashQuery.data?.oralConfirmationDeals ?? [];
  const principalStats = dashQuery.data?.byPrincipal ?? [];
  // The aggregate already names every salesperson in scope, so the quick-add
  // modal gets its options without a second request.
  const salespeopleOptions = (dashQuery.data?.bySalesperson ?? []).map((r: DashboardBreakdown) => ({
    id: r.id,
    name: r.name,
  }));
  const categoryStats = dashQuery.data?.byCategory ?? [];

  return (
    <div className="space-y-5">
      {/*
        Quick actions, and nothing else.

        This was a banner: an eyebrow reading "Commercial Sales Pulse", a
        headline reading "Revenue Performance & Pipeline Tracker", and a line
        of copy under it. All three said what the page is, to somebody already
        standing on it who reached it by clicking "Dashboard" — and they cost
        the top sixth of the screen, pushing the figures people come here for
        below the fold. The buttons were the only part of it anyone used, so
        they are what is left.

        Management gets no create buttons — it reads the workspace rather than
        adding to it — but targets are precisely management's job, so that
        button sits outside the block that hides the rest.
      */}
      {(role !== "mgmt" || canManageTargets) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {role !== "mgmt" && (
            <>
              <Button size="sm" onClick={() => setShowAddLead(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New Sales Lead
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowAddCustomer(true)}>
                <Building2 className="h-3.5 w-3.5 mr-1" /> Add Customer
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreateOrder(true)}>
                <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Create Order
              </Button>
            </>
          )}
          {canManageTargets && (
            <Button size="sm" variant="outline" onClick={() => setShowTargets(true)}>
              <Target className="h-3.5 w-3.5 mr-1" /> Targets
            </Button>
          )}
        </div>
      )}

      <QueryBoundary
        isLoading={dashQuery.isLoading}
        isError={dashQuery.isError}
        error={dashQuery.error}
      >
        <div className="space-y-5">
          {/* 6 Top KPI Cards with Visual Depth */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs hover:border-muted transition-colors">
              {/* Named with its MONTHS, not the window: a recurring
                  commitment is a month, so a day or a week shows that month's
                  figure and has to say so. "₹0 recurring this Tuesday" would
                  be a sentence about nothing. */}
              <div className="text-3xs font-bold uppercase tracking-wider text-muted">
                Recurring committed{isSubMonth && ` · ${recurringLabel}`}
              </div>
              <div className="text-xl font-black text-ink mt-1 tabular-nums">{lakhs(recurringCommitted)}</div>
              <div className="text-xs text-muted mt-0.5">Achieved: {lakhs(recurringAchieved)}</div>
            </div>

            <div className="rounded-xl border border-brand/40 bg-brand-soft/70 p-3.5 shadow-xs">
              <div className="text-3xs font-bold uppercase tracking-wider text-brand-ink">
                Recurring achieved{isSubMonth && ` · ${recurringLabel}`}
              </div>
              <div className="text-xl font-black text-brand-ink mt-1 tabular-nums">{lakhs(recurringAchieved)}</div>
              <div className="text-xs text-brand-ink/80 mt-0.5 font-semibold">
                {recPct != null ? `${recPct.toFixed(1)}% achieved` : "—"}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs hover:border-muted transition-colors">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">New sales committed</div>
              <div className="text-xl font-black text-ink mt-1 tabular-nums">
                {dashQuery.isLoading ? <KpiSkeleton /> : lakhs(newSalesCommitted)}
              </div>
              <div className="text-xs text-muted mt-0.5">
                Won: {dashQuery.isLoading ? "…" : lakhs(newSalesAchieved)}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs hover:border-muted transition-colors">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Total committed</div>
              <div className="text-xl font-black text-ink mt-1 tabular-nums">
                {dashQuery.isLoading ? <KpiSkeleton /> : lakhs(totalCommitted)}
              </div>
              <div className="text-xs text-muted mt-0.5">Recurring + New sales</div>
            </div>

            <div className="rounded-xl border border-brand/40 bg-brand-soft/70 p-3.5 shadow-xs">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-brand-ink">Total achieved</div>
              <div className="text-xl font-black text-brand-ink mt-1 tabular-nums">
                {dashQuery.isLoading ? <KpiSkeleton /> : lakhs(totalAchieved)}
              </div>
              {/* This line used to read "N% target" while showing achieved
                  over COMMITTED — the pipeline's own number, not a target
                  anyone had set. There is a real target now, so each figure is
                  labelled as itself and the target only appears once set. */}
              <div className="text-xs text-brand-ink/80 mt-0.5 font-semibold">
                {dashQuery.isLoading
                  ? "…"
                  : target != null
                    ? `${targetPct != null ? `${targetPct.toFixed(1)}% of ` : ""}${lakhs(target)} target`
                    : totalPct != null
                      ? `${totalPct.toFixed(1)}% of committed`
                      : "—"}
              </div>
              {!dashQuery.isLoading && target == null && canManageTargets && (
                <button
                  type="button"
                  onClick={() => setShowTargets(true)}
                  className="mt-1 text-3xs font-bold uppercase tracking-wider text-brand-ink/70 hover:text-brand-ink cursor-pointer"
                >
                  Set a target
                </button>
              )}
            </div>

            {/* The only tile you can open. It counts follow-ups across leads,
                recurring lines, standalone tasks and unpaid invoices, and the
                Follow-ups page lists only the third — so a number here with no
                way to see what it is made of sent people to a page that looked
                empty and wrong. */}
            <button
              type="button"
              onClick={() => fuDue + fuOverdue > 0 && setShowFollowUps(true)}
              disabled={dashQuery.isLoading || fuDue + fuOverdue === 0}
              className={cn(
                "rounded-xl border p-3.5 shadow-xs text-left transition-colors",
                fuOverdue > 0 ? "border-red/40 bg-red-soft/70" : "border-line bg-surface",
                fuDue + fuOverdue > 0
                  ? "cursor-pointer hover:border-ink/30"
                  : "cursor-default",
              )}
            >
              <div className={cn("text-[10.5px] font-bold uppercase tracking-wider", fuOverdue > 0 ? "text-red" : "text-muted")}>
                Follow-ups due
              </div>
              <div className={cn("text-xl font-black mt-1 tabular-nums", fuOverdue > 0 ? "text-red" : "text-ink")}>
                {dashQuery.isLoading ? <KpiSkeleton /> : fuDue + fuOverdue}
              </div>
              <div className={cn("text-xs mt-0.5 font-semibold", fuOverdue > 0 ? "text-red" : "text-muted")}>
                {dashQuery.isLoading ? "…" : fuOverdue > 0 ? `${fuOverdue} overdue` : "All up to date"}
              </div>
            </button>
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

                <QueryBoundary isLoading={dashQuery.isLoading} isError={dashQuery.isError} error={dashQuery.error}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line whitespace-nowrap">
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
                              <td className="py-2.5 px-3 tabular-nums text-muted whitespace-nowrap">
                              {longDate(l.nextFollowUp)}
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

            </div>
          ) : (
            /* Admin & Management Dashboard Views */
            <div className="space-y-5">
              {/* 1. Committed vs achieved by salesperson chart */}
              <Card className="p-4 shadow-xs border-line">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-sm text-ink">
                    Committed vs achieved by salesperson — {windowLabel}
                  </div>
                  <CompareLegend />
                </div>
                <QueryBoundary isLoading={dashQuery.isLoading} isError={dashQuery.isError} error={dashQuery.error}>
                  <div className="pt-2">
                    <GroupedBars data={spChartItems} />
                  </div>
                </QueryBoundary>
              </Card>

              {/* 3. Deals at Oral Confirmation */}
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

                <QueryBoundary isLoading={dashQuery.isLoading} isError={dashQuery.isError} error={dashQuery.error}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line whitespace-nowrap">
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
                    {/* All of them, not the first six. The heading promises
                        principal performance and the list arrives sorted by
                        committed value, so truncating it silently dropped the
                        smallest brands off a card that claimed to cover them. */}
                    {principalStats.map((pr) => {
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

      {/*
        The follow-up modal and the customer drawer went with the Top open
        projections table: its rows were the only thing that ever opened
        either, so both were left permanently shut. Dead state that reads as
        live is worse than no state — the next person to touch this page would
        have spent an afternoon working out why a drawer wired to a `null` that
        nothing assigns never appears.
      */}
      <AddLeadModal
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
        salespeople={salespeopleOptions}
        // No industries: this page no longer loads leads, and there is still
        // no industries endpoint to ask (checklists/03-API.md C.3.12). The
        // modal already handles an empty list ("No industries yet"), and
        // refetching every lead to fill one dropdown is what this slice
        // removed. The Leads page, which does load leads, still offers them.
        industries={[]}
      />
      <AddCustomerModal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />
      <CreateSalesOrderModal open={showCreateOrder} onClose={() => setShowCreateOrder(false)} />

      {showTargets && (
        <SetTargetsModal
          open
          onClose={() => setShowTargets(false)}
          period={range.months[0]}
        />
      )}

      <FollowUpsDueModal
        open={showFollowUps}
        onClose={() => setShowFollowUps(false)}
        items={dashQuery.data?.followUps ?? []}
        due={fuDue}
        overdue={fuOverdue}
      />
    </div>
  );
}
