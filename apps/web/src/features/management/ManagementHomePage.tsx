import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  BarChart3,
  Building2,
  ChevronRight,
  Layers,
  Search,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { useMonth, useUi } from "@/store/ui";
import { resolveRange } from "@/data/periodRange";
import { useAuth } from "@/store/auth";
import { useManagements } from "@/features/management/queries";
import { useDashboard } from "@/features/dashboard/queries";
import { useUsers, flattenUsers } from "@/features/users/queries";
import { featurePath } from "@/data/features";
import { useRolePath } from "@/lib/rolePath";
import { inr, lakhs, pct } from "@/lib/format";
import { periodLabel } from "@/data/months";
import { MonthSelect } from "@/components/MonthSelect";
import { Button, Card, PageHeader } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { GroupedBars } from "@/components/charts";

/**
 * The management landing page.
 *
 * EVERY figure here used to come from `trackerStore` — a zustand `persist`
 * store seeded from `data/demoSeedData.ts` and held in the visitor's
 * localStorage. The page made no API call at all, so an executive reading it
 * was reading POC fixtures dressed as their own numbers, and the "workspaces"
 * it listed existed only in that browser.
 *
 * It now composes three endpoints that already existed:
 *
 *   - GET /managements  → the workspace itself and its record counts
 *   - GET /dashboard    → KPIs, per-salesperson and per-principal breakdowns
 *   - GET /users        → the roster, so a rep with no activity still appears
 *
 * The rep and principal tables are NOT recomputed here. `/dashboard` already
 * owns that arithmetic and the projections worksheet uses the same engine —
 * two implementations of "what is this worth" is how a summary and a report end
 * up disagreeing in front of a customer.
 */
export default function ManagementHomePage() {
  const rolePath = useRolePath();
  const navigate = useNavigate();
  const accessToken = useAuth((s) => s.accessToken);
  const activeManagementId = useUi((s) => s.activeManagementId);
  // The window's month. A worksheet IS a month, so a week window opens the
  // month containing it — one selection in the store, read two ways.
  const month = useMonth();
  const setMonth = useUi((s) => s.setMonth);

  const [searchQuery, setSearchQuery] = useState("");

  const managementsQ = useManagements();
  const management = managementsQ.data?.[0] ?? null;
  // This page is a month at a time — it sits beside a month dropdown — so it
  // resolves the month to its window rather than carrying a second kind of
  // period selection of its own.
  const dashQ = useDashboard(resolveRange("month", `${month}-01`), {
    enabled: !!accessToken,
  });
  const usersQ = useUsers();

  const kpis = dashQ.data?.kpis;
  const bySalesperson = dashQ.data?.bySalesperson ?? [];
  const byPrincipal = dashQ.data?.byPrincipal ?? [];

  // The roster is the source of "who is a rep", not the breakdown: a
  // salesperson with nothing booked this month has no row in `bySalesperson`
  // and must still be listed, at zero, or the page quietly hides the people
  // whose numbers most need looking at.
  const reps = flattenUsers(usersQ.data).filter((u) =>
    u.roleName?.toLowerCase().includes("sales"),
  );
  const byId = new Map(bySalesperson.map((b) => [b.id, b]));
  const repRows = reps
    .map((u) => {
      const b = byId.get(u.id);
      return {
        id: u.id,
        name: u.name,
        committed: b?.committed ?? 0,
        achieved: b?.achieved ?? 0,
      };
    })
    .filter((r) =>
      r.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
    )
    .sort((a, b) => b.achieved - a.achieved);

  const monthLabel = periodLabel(month);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* A fixed eyebrow above the (data-dependent) workspace name, so the
            page has one stable identity — for the reader and for the route
            test, which cannot assert on a title that is a tenant's name. */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand">
            Super Admin Hub
          </div>
        <PageHeader
          title={management?.name ?? "Management Overview"}
          subtitle={`Cross-team performance for ${monthLabel}, from the same aggregate the dashboard reads`}
        />
        </div>
        <div className="flex items-center gap-2">
          <MonthSelect
            value={month}
            onChange={setMonth}
            ariaLabel="Reporting month"
            className="w-[140px]"
          />
          {activeManagementId && (
            <Button
              size="sm"
              onClick={() =>
                navigate(featurePath("dashboard", activeManagementId, rolePath))
              }
            >
              Open workspace <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Workspace facts. Counts come from the server, not from paging lists. */}
      <QueryBoundary
        isLoading={managementsQ.isLoading}
        isError={managementsQ.isError}
        error={managementsQ.error}
        isEmpty={!management}
        emptyLabel="No workspace returned for this account."
      >
        {management && (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2.5 mr-auto">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-ink">
                    {management.name}
                  </div>
                  <div className="text-[11px] font-semibold text-muted">
                    {management.industry || "Industry not set"} ·{" "}
                    {management.region || "Region not set"} · plan{" "}
                    {management.plan}
                  </div>
                </div>
              </div>
              <Fact icon={Users} label="Users" value={management.userCount} />
              <Fact
                icon={Building2}
                label="Customers"
                value={management.customerCount}
              />
              <Fact
                icon={Layers}
                label="Products"
                value={management.productCount}
              />
              <span className="rounded-full border border-brand/20 bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
                <ShieldCheck className="mr-1 inline h-3 w-3" />
                {management.status}
              </span>
            </div>
          </Card>
        )}
      </QueryBoundary>

      {/* KPIs — final figures from /dashboard, never recomputed here. */}
      <QueryBoundary
        isLoading={dashQ.isLoading}
        isError={dashQ.isError}
        error={dashQ.error}
        isEmpty={!kpis}
        emptyLabel="No aggregate for this month yet."
      >
        {kpis && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Committed"
              value={lakhs(kpis.totalCommitted)}
              hint="recurring + new sales"
            />
            <Kpi
              label="Achieved"
              value={lakhs(kpis.totalAchieved)}
              hint={pct(kpis.totalPct) + " of commitment"}
            />
            <Kpi
              label="Recurring"
              value={lakhs(kpis.recurringAchieved)}
              hint={`of ${lakhs(kpis.recurringCommitted)} projected`}
            />
            <Kpi
              label="Follow-ups overdue"
              value={String(kpis.followUpsOverdue)}
              hint={`${kpis.followUpsDue} due today`}
              alert={kpis.followUpsOverdue > 0}
            />
          </div>
        )}
      </QueryBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Salespeople */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <Award className="h-3.5 w-3.5 text-brand" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink">
              Salesperson performance
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <Search className="h-3 w-3 text-muted" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter reps…"
                aria-label="Filter salespeople"
                className="w-32 rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11px] text-ink placeholder:text-muted focus:outline-brand"
              />
            </div>
          </div>
          <div className="max-h-[340px] overflow-y-auto">
            {repRows.length === 0 ? (
              <div className="p-6 text-center text-xs font-medium text-muted">
                No salespeople match.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-2 text-[11px] uppercase tracking-wider text-muted whitespace-nowrap">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold">Rep</th>
                    <th className="px-3 py-2 text-right font-bold">Committed</th>
                    <th className="px-3 py-2 text-right font-bold">Achieved</th>
                    <th className="px-3 py-2 text-right font-bold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {repRows.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-2/70">
                      <td className="px-3 py-2 font-bold text-ink">{r.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">
                        {inr(r.committed)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-ink">
                        {inr(r.achieved)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-brand">
                        {r.committed > 0
                          ? pct((r.achieved / r.committed) * 100)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Principals */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <BarChart3 className="h-3.5 w-3.5 text-brand" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink">
              Principal performance
            </span>
            <span className="ml-auto text-[11px] font-semibold text-muted">
              Recurring only
            </span>
          </div>
          <div className="p-4">
            {byPrincipal.length === 0 ? (
              <div className="py-8 text-center text-xs font-medium text-muted">
                <Target className="mx-auto mb-2 h-4 w-4 text-muted/60" />
                No projections for {monthLabel}.
              </div>
            ) : (
              <GroupedBars
                data={byPrincipal.map((p) => ({
                  label: p.name,
                  committed: p.committed,
                  achieved: p.achieved,
                }))}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted" />
      <div>
        <div className="text-sm font-bold tabular-nums text-ink">{value}</div>
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  alert = false,
}: {
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <Card className="p-3.5">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-bold tabular-nums ${alert ? "text-red" : "text-ink"}`}
      >
        {value}
      </div>
      <div className="text-[11px] font-medium text-muted">{hint}</div>
    </Card>
  );
}
