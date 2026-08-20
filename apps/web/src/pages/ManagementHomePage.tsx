import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Crown,
  Sparkles,
  Building2,
  Users,
  Target,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers,
  Award,
  BarChart3,
  ChevronRight,
  Mail,
} from "lucide-react";
import { useManagementStore } from "../store/managementStore";
import { useTrackerStore } from "../store/trackerStore";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../store/ui";
import { useAuth } from "../store/auth";
import { CreateManagementModal } from "../components/modals/CreateManagementModal";
import { inr, lakhs, pct } from "../lib/format";
import { MONTHS } from "../data/constants";
import { GroupedBars, CompareLegend } from "../components/charts";

type ActiveTab = "overview" | "salespersons" | "workspaces" | "principals";

export default function ManagementHomePage() {
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  const setActiveManagement = useUi((s) => s.setActiveManagement);

  const managements = useManagementStore((s) => s.managements);
  const { users, projections, leads, payments, principals, products, customers } = useTrackerStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [selectedMonth, setSelectedMonth] = useState("2026-08");
  const [searchQuery, setSearchQuery] = useState("");
  const [performanceFilter, setPerformanceFilter] = useState<"ALL" | "TOP" | "TRACK" | "BEHIND">("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);

  // Month label
  const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  // Salespersons list
  const salespeople = useMemo(() => users.filter((u) => u.role === "sales"), [users]);

  // Overall Global Progress & KPIs
  const kpis = useMemo(() => {
    // Projections for selected month
    const monthProjs = projections.filter((p) => p.month === selectedMonth);
    const recurringCommitted = monthProjs.reduce((s, p) => s + p.projectedQty * p.price, 0);
    const recurringAchieved = monthProjs.reduce((s, p) => s + p.achievedQty * p.price, 0);

    // New sales leads
    const openLeads = leads.filter((l) => !["Closed Won", "Closed Lost", "No Requirement or Cold"].includes(l.stage));
    const newCommitted = openLeads.reduce((s, l) => s + (l.products || []).reduce((acc, p) => acc + (p.value || 0), 0), 0);
    const wonLeads = leads.filter((l) => l.stage === "Closed Won");
    const newAchieved = wonLeads.reduce((s, l) => s + (l.products || []).reduce((acc, p) => acc + (p.value || 0), 0), 0);

    const totalCommitted = recurringCommitted + newCommitted;
    const totalAchieved = recurringAchieved + newAchieved;
    const overallAchievementRate = totalCommitted > 0 ? (totalAchieved / totalCommitted) * 100 : 0;
    const recurringAchievementRate = recurringCommitted > 0 ? (recurringAchieved / recurringCommitted) * 100 : 0;

    // Payments & Receivables
    const totalOutstanding = payments.reduce((s, p) => s + p.amount, 0);
    const collectedPayments = payments.filter((p) => (p.received || 0) > 0).reduce((s, p) => s + (p.received || 0), 0);

    // Follow-ups
    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueFollowUps =
      projections.filter((p) => p.nextFollowUp && p.nextFollowUp < todayStr).length +
      leads.filter((l) => l.nextFollowUp && l.nextFollowUp < todayStr).length;

    return {
      recurringCommitted,
      recurringAchieved,
      recurringAchievementRate,
      newCommitted,
      newAchieved,
      totalCommitted,
      totalAchieved,
      overallAchievementRate,
      totalOutstanding,
      collectedPayments,
      overdueFollowUps,
      totalCustomers: customers.length,
      totalPrincipals: principals.length,
      activeReps: salespeople.length,
    };
  }, [projections, leads, payments, customers, principals, salespeople, selectedMonth]);

  // Salesperson Performance Breakdown
  const repPerformance = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return salespeople.map((rep) => {
      const repProjs = projections.filter((p) => p.ownerId === rep.id && p.month === selectedMonth);
      const committed = repProjs.reduce((s, p) => s + p.projectedQty * p.price, 0);
      const achieved = repProjs.reduce((s, p) => s + p.achievedQty * p.price, 0);
      const achievementPct = committed > 0 ? (achieved / committed) * 100 : 0;

      const repLeads = leads.filter((l) => l.ownerId === rep.id);
      const hotDeals = repLeads.filter((l) => ["Negotiation / Oral Confirmation", "Proposals & Price Quote"].includes(l.stage));
      const hotDealsVal = hotDeals.reduce((s, l) => s + (l.products || []).reduce((acc, p) => acc + (p.value || 0), 0), 0);

      const repPayments = payments.filter((p) => p.ownerId === rep.id);
      const outstanding = repPayments.reduce((s, p) => s + p.amount, 0);

      const overdueFus =
        repProjs.filter((p) => p.nextFollowUp && p.nextFollowUp < todayStr).length +
        repLeads.filter((l) => l.nextFollowUp && l.nextFollowUp < todayStr).length;

      let tier: "TOP" | "TRACK" | "BEHIND" = "TRACK";
      if (achievementPct >= 50) tier = "TOP";
      else if (achievementPct < 30) tier = "BEHIND";

      return {
        ...rep,
        committed,
        achieved,
        achievementPct,
        activeLines: repProjs.length,
        hotDealsCount: hotDeals.length,
        hotDealsVal,
        outstanding,
        overdueFus,
        tier,
      };
    }).sort((a, b) => b.achievementPct - a.achievementPct);
  }, [salespeople, projections, leads, payments, selectedMonth]);

  // Filtered reps
  const filteredReps = useMemo(() => {
    return repPerformance.filter((rep) => {
      const matchesSearch =
        rep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.email.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (performanceFilter === "TOP") return rep.tier === "TOP";
      if (performanceFilter === "TRACK") return rep.tier === "TRACK";
      if (performanceFilter === "BEHIND") return rep.tier === "BEHIND";
      return true;
    });
  }, [repPerformance, searchQuery, performanceFilter]);

  // Grouped Bar Data for Sales Reps
  const repChartData = useMemo(() => {
    return repPerformance.slice(0, 7).map((r) => ({
      label: r.name.split(" ")[0],
      committed: r.committed,
      achieved: r.achieved,
    }));
  }, [repPerformance]);

  // Principals breakdown
  const principalPerformance = useMemo(() => {
    const productPrincipalMap = new Map(products.map((p) => [p.id, p.principalId]));

    return principals.map((prin) => {
      const prinProjs = projections.filter((p) => {
        const pId = productPrincipalMap.get(p.productId);
        return pId === prin.id && p.month === selectedMonth;
      });
      const committed = prinProjs.reduce((s, p) => s + p.projectedQty * p.price, 0);
      const achieved = prinProjs.reduce((s, p) => s + p.achievedQty * p.price, 0);
      const pctVal = committed > 0 ? (achieved / committed) * 100 : 0;
      return {
        ...prin,
        committed,
        achieved,
        pctVal,
        lines: prinProjs.length,
      };
    }).sort((a, b) => b.committed - a.committed);
  }, [principals, products, projections, selectedMonth]);

  // Selected rep for drill down modal
  const selectedRepData = useMemo(() => {
    if (!selectedRepId) return null;
    return repPerformance.find((r) => r.id === selectedRepId) || null;
  }, [selectedRepId, repPerformance]);

  const handleLaunchManagement = (mId: string) => {
    setActiveManagement(mId);
    navigate(`/managements/${mId}/dashboard`);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink pb-16">
      {/* ── Global Super Admin Top Header ── */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-emerald-800 text-white shadow-md shadow-brand/20">
              <Crown className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight">GreatSales</span>
                <span className="rounded bg-purple-500/15 border border-purple-400/30 px-2 py-0.5 text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  Super Admin Hub
                </span>
              </div>
              <p className="text-xs text-muted font-medium">Enterprise Multi-Tenant Portfolio &amp; Performance Control</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Month selector */}
            <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 shadow-2xs">
              <Calendar className="h-4 w-4 text-muted" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-ink outline-none cursor-pointer"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Create Management Button */}
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand text-white text-xs font-bold shadow-xs hover:bg-brand-ink transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Workspace</span>
            </button>

            {/* Logout button */}
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/super-admin/login");
              }}
              title="Sign Out Super Admin"
              className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface-2 text-muted hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">

        {/* ── Executive Hero Banner & Portfolio Progress Overview ── */}
        <section className="rounded-2xl border border-line bg-gradient-to-br from-brand-ink via-slate-900 to-slate-950 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, #10b981 0, transparent 40%), radial-gradient(circle at 80% 80%, #6366f1 0, transparent 40%)",
            }}
          />

          <div className="relative z-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                    Enterprise Executive Pulse · {monthLabel}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Portfolio Revenue &amp; Field Performance Overview
                </h1>
                <p className="text-xs sm:text-sm text-white/70 max-w-2xl mt-1">
                  Cross-company analytics consolidating recurring commitment grids, new sales pipelines, and sales team target achievement.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto bg-white/10 border border-white/15 px-3 py-2 rounded-xl backdrop-blur-sm">
                <Building2 className="h-4 w-4 text-emerald-400" />
                <div className="text-left">
                  <div className="text-[11px] text-white/60 font-semibold uppercase">Total Workspaces</div>
                  <div className="text-sm font-bold text-white">{managements.length} Active Companies</div>
                </div>
              </div>
            </div>

            {/* KPI Summary Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
              {/* Card 1: Total Committed */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Total Committed</span>
                  <Target className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-white tracking-tight tabular-nums">
                  {lakhs(kpis.totalCommitted)}
                </div>
                <div className="text-[11px] text-white/60 flex items-center justify-between">
                  <span>Recurring: {lakhs(kpis.recurringCommitted)}</span>
                  <span>New: {lakhs(kpis.newCommitted)}</span>
                </div>
              </div>

              {/* Card 2: Total Achieved & Progress */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Realized / Achieved</span>
                  <Award className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-300 tracking-tight tabular-nums">
                  {lakhs(kpis.totalAchieved)}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-white/70">
                    <span>Overall Realization</span>
                    <span>{pct(kpis.overallAchievementRate)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, kpis.overallAchievementRate)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Field Force Activity */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Field Sales Force</span>
                  <Users className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-2xl font-extrabold text-white tracking-tight tabular-nums">
                  {kpis.activeReps} <span className="text-sm font-medium text-white/60">Reps Active</span>
                </div>
                <div className="text-[11px] text-white/60 flex items-center justify-between">
                  <span>{kpis.totalCustomers} Customers</span>
                  <span>{kpis.totalPrincipals} Principals</span>
                </div>
              </div>

              {/* Card 4: Receivables & Action Items */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Receivables &amp; SLA</span>
                  <AlertCircle className={`h-4 w-4 ${kpis.overdueFollowUps > 0 ? "text-rose-400" : "text-emerald-400"}`} />
                </div>
                <div className="text-2xl font-extrabold text-white tracking-tight tabular-nums">
                  {lakhs(kpis.totalOutstanding)}
                </div>
                <div className="text-[11px] text-white/60 flex items-center justify-between">
                  <span className={kpis.overdueFollowUps > 0 ? "text-rose-300 font-bold" : "text-emerald-300 font-semibold"}>
                    {kpis.overdueFollowUps} Overdue Follow-ups
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── View Navigation Tabs ── */}
        <section className="flex items-center justify-between gap-4 border-b border-line pb-3 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-surface-2 rounded-xl border border-line">
            {[
              { id: "overview" as ActiveTab, label: "Overview & Charts", icon: BarChart3 },
              { id: "salespersons" as ActiveTab, label: "Sales Team Performance", icon: Users, badge: `${salespeople.length}` },
              { id: "workspaces" as ActiveTab, label: "Company Workspaces", icon: Building2, badge: `${managements.length}` },
              { id: "principals" as ActiveTab, label: "Brand Principals", icon: Layers },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-surface text-ink shadow-xs border border-line"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-brand" : "text-muted"}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${isActive ? "bg-brand/10 text-brand" : "bg-surface-3 text-muted"}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search bar & filter controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 shadow-2xs">
              <Search className="h-4 w-4 text-muted" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search salesperson or workspace…"
                className="bg-transparent text-xs outline-none text-ink placeholder:text-muted w-48 sm:w-56"
              />
            </div>

            {activeTab === "salespersons" && (
              <select
                value={performanceFilter}
                onChange={(e) => setPerformanceFilter(e.target.value as any)}
                className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink outline-none cursor-pointer"
              >
                <option value="ALL">All Performers</option>
                <option value="TOP">Top (&ge;50% Target)</option>
                <option value="TRACK">On Track (30-50%)</option>
                <option value="BEHIND">Needs Attention (&lt;30%)</option>
              </select>
            )}
          </div>
        </section>

        {/* ── TAB CONTENT 1: Overview & Charts ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Sales Rep Grouped Comparison Bar Chart */}
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-ink font-sans">
                    Salesperson Commitment vs. Realized Achievement ({monthLabel})
                  </h3>
                  <p className="text-xs text-muted">
                    Individual recurring sales target conversion across all active field representatives.
                  </p>
                </div>
                <CompareLegend />
              </div>

              <div className="pt-2">
                <GroupedBars data={repChartData} />
              </div>
            </div>

            {/* Top Performers Leaderboard Row & Workspace Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Leaderboard Pod (2 cols) */}
              <div className="lg:col-span-2 rounded-2xl border border-line bg-surface p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    <h3 className="text-base font-extrabold text-ink">Field Rep Leaderboard</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("salespersons")}
                    className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    View All {salespeople.length} Reps <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {repPerformance.slice(0, 4).map((rep, idx) => (
                    <div
                      key={rep.id}
                      onClick={() => setSelectedRepId(rep.id)}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-surface-2/60 hover:bg-surface-2 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`grid h-8 w-8 place-items-center rounded-lg font-black text-xs ${
                          idx === 0 ? "bg-amber-100 text-amber-800 border border-amber-300" :
                          idx === 1 ? "bg-slate-200 text-slate-800 border border-slate-300" :
                          idx === 2 ? "bg-amber-900/10 text-amber-900 border border-amber-700/30" :
                          "bg-surface-3 text-muted"
                        }`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-ink group-hover:text-brand transition-colors">
                            {rep.name}
                          </div>
                          <div className="text-[11px] text-muted">
                            Committed: {lakhs(rep.committed)} · Achieved: <span className="font-bold text-emerald-600 dark:text-emerald-400">{lakhs(rep.achieved)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs font-extrabold text-ink tabular-nums">
                            {pct(rep.achievementPct)}
                          </div>
                          <div className="w-24 h-1.5 rounded-full bg-surface-3 overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                rep.achievementPct >= 50 ? "bg-emerald-500" :
                                rep.achievementPct >= 30 ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, rep.achievementPct)}%` }}
                            />
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted group-hover:text-ink transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workspaces Summary Pod (1 col) */}
              <div className="rounded-2xl border border-line bg-surface p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-brand" />
                    <h3 className="text-base font-extrabold text-ink">Workspaces</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("workspaces")}
                    className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Manage <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {managements.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-xl border border-line bg-surface-2/60 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand font-extrabold text-xs">
                            {m.initials}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-ink truncate max-w-[140px]">{m.name}</div>
                            <div className="text-[10px] text-muted">{m.industry} · {m.currency}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleLaunchManagement(m.id)}
                          className="px-2.5 py-1 rounded-lg bg-brand/10 text-brand text-[11px] font-bold hover:bg-brand hover:text-white transition-colors cursor-pointer"
                        >
                          Launch
                        </button>
                      </div>

                      {/* Mini progress bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[10.5px] text-muted font-medium">
                          <span>Progress: {lakhs(kpis.recurringAchieved)} / {lakhs(kpis.recurringCommitted)}</span>
                          <span className="font-bold text-ink">{pct(kpis.recurringAchievementRate)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(100, kpis.recurringAchievementRate)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB CONTENT 2: Sales Team Performance Matrix ── */}
        {activeTab === "salespersons" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-ink">
                  Sales Representative Performance Matrix
                </h3>
                <p className="text-xs text-muted">
                  Full granular breakdown of monthly commitments, realized revenue, deals in pipeline, and receivables per representative.
                </p>
              </div>
              <span className="text-xs font-bold text-muted">
                Showing {filteredReps.length} of {salespeople.length} Representatives
              </span>
            </div>

            {/* Rep Performance Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReps.map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-brand/50 transition-colors"
                >
                  {/* Top info */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-soft to-surface-2 text-brand font-black text-sm border border-brand/20">
                          {rep.name.split(" ").map((w) => w[0]).join("")}
                        </div>
                        <div>
                          <div className="text-sm font-extrabold text-ink">{rep.name}</div>
                          <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" /> {rep.email}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          rep.tier === "TOP"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : rep.tier === "TRACK"
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                        }`}
                      >
                        {rep.tier === "TOP" ? "Top Performer" : rep.tier === "TRACK" ? "On Track" : "Needs Attention"}
                      </span>
                    </div>

                    {/* Progress Bar & Realization Numbers */}
                    <div className="p-3 rounded-xl bg-surface-2 space-y-2 border border-line/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted">Monthly Target:</span>
                        <span className="font-extrabold text-ink tabular-nums">{inr(rep.committed)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted">Achieved Realization:</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{inr(rep.achieved)}</span>
                      </div>

                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-muted">Conversion Rate</span>
                          <span className="text-ink tabular-nums">{pct(rep.achievementPct)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              rep.tier === "TOP" ? "bg-emerald-500" : rep.tier === "TRACK" ? "bg-amber-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${Math.min(100, rep.achievementPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Secondary Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg border border-line bg-surface-2/40">
                        <div className="text-[10px] font-bold uppercase text-muted">Hot Deals</div>
                        <div className="text-xs font-bold text-ink mt-0.5">
                          {rep.hotDealsCount} ({lakhs(rep.hotDealsVal)})
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-line bg-surface-2/40">
                        <div className="text-[10px] font-bold uppercase text-muted">Receivables</div>
                        <div className="text-xs font-bold text-ink mt-0.5">
                          {lakhs(rep.outstanding)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-line flex items-center justify-between">
                    <span className="text-[11px] text-muted flex items-center gap-1">
                      {rep.overdueFus > 0 ? (
                        <span className="text-rose-600 font-bold flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" /> {rep.overdueFus} Overdue
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Follow-ups up to date
                        </span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedRepId(rep.id)}
                      className="text-xs font-bold text-brand hover:text-brand-ink flex items-center gap-1 cursor-pointer"
                    >
                      Inspect Rep <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB CONTENT 3: Company Workspaces Portfolio ── */}
        {activeTab === "workspaces" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-ink">
                  Company Workspaces &amp; Tenancy Portfolio
                </h3>
                <p className="text-xs text-muted">
                  Multi-tenant isolation and workspace administration. Each workspace operates with its own isolated data, customer assignments, and permissions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand text-white text-xs font-bold shadow-xs hover:bg-brand-ink transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Create Workspace
              </button>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {managements.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-brand/40 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink font-black text-base shadow-2xs">
                          {m.initials}
                        </div>
                        <div>
                          <div className="text-sm font-extrabold text-ink">{m.name}</div>
                          <div className="text-xs text-muted font-medium mt-0.5">
                            {m.industry || "General"} · {m.currency}
                          </div>
                        </div>
                      </div>
                      <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                        Active
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-2">
                      <div className="p-2 rounded-lg bg-surface-2 border border-line/60">
                        <div className="text-[10px] uppercase font-bold text-muted">Team</div>
                        <div className="text-xs font-extrabold text-ink mt-0.5">{salespeople.length} Reps</div>
                      </div>
                      <div className="p-2 rounded-lg bg-surface-2 border border-line/60">
                        <div className="text-[10px] uppercase font-bold text-muted">Accounts</div>
                        <div className="text-xs font-extrabold text-ink mt-0.5">{customers.length} Cust</div>
                      </div>
                      <div className="p-2 rounded-lg bg-surface-2 border border-line/60">
                        <div className="text-[10px] uppercase font-bold text-muted">Principals</div>
                        <div className="text-xs font-extrabold text-ink mt-0.5">{principals.length}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-line flex items-center justify-between">
                    <span className="text-[11px] text-muted">
                      Created: {m.createdAt}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleLaunchManagement(m.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold shadow-xs hover:bg-brand-ink transition-colors cursor-pointer"
                    >
                      Open Dashboard <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Create new workspace trigger card */}
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded-2xl border border-dashed border-line hover:border-brand/60 p-6 flex flex-col items-center justify-center gap-3 text-muted min-h-[220px] transition-all bg-surface/50 hover:bg-brand-soft/20 cursor-pointer"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand shadow-xs">
                  <Plus className="h-6 w-6" />
                </span>
                <div className="text-center">
                  <span className="text-sm font-bold text-ink block">Create New Management</span>
                  <span className="text-xs text-muted block mt-0.5">Deploy dedicated tenant workspace</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── TAB CONTENT 4: Brand Principals Performance ── */}
        {activeTab === "principals" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-ink">
                  Principal &amp; Brand Performance Matrix
                </h3>
                <p className="text-xs text-muted">
                  Revenue contribution and conversion tracking per OEM brand partner ({monthLabel}).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {principalPerformance.map((prin) => (
                <div
                  key={prin.id}
                  className="rounded-2xl border border-line bg-surface p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand font-bold text-xs">
                        {prin.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-ink">{prin.name}</div>
                        <div className="text-[11px] text-muted">{prin.lines} active projection lines</div>
                      </div>
                    </div>
                    <span className="rounded bg-surface-2 border border-line px-2 py-0.5 text-[11px] font-extrabold text-ink tabular-nums">
                      {pct(prin.pctVal)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-2 space-y-2 border border-line/60">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted font-medium">Committed:</span>
                      <span className="font-bold text-ink tabular-nums">{inr(prin.committed)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted font-medium">Achieved:</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{inr(prin.achieved)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, prin.pctVal)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Salesperson Deep-Dive Modal ── */}
      {selectedRepData && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs grid place-items-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white font-black text-sm">
                  {selectedRepData.name.split(" ").map((w) => w[0]).join("")}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-ink">{selectedRepData.name}</h3>
                  <p className="text-xs text-muted">{selectedRepData.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRepId(null)}
                className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-muted hover:text-ink hover:bg-surface-2 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-surface-2 border border-line/60">
                  <div className="text-[10px] font-bold uppercase text-muted">Committed Target</div>
                  <div className="text-sm font-extrabold text-ink mt-0.5">{inr(selectedRepData.committed)}</div>
                </div>
                <div className="p-3 rounded-xl bg-surface-2 border border-line/60">
                  <div className="text-[10px] font-bold uppercase text-muted">Realized Revenue</div>
                  <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{inr(selectedRepData.achieved)}</div>
                </div>
                <div className="p-3 rounded-xl bg-surface-2 border border-line/60">
                  <div className="text-[10px] font-bold uppercase text-muted">Achievement</div>
                  <div className="text-sm font-extrabold text-brand mt-0.5">{pct(selectedRepData.achievementPct)}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-line bg-surface-2/60 space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">Performance Summary</h4>
                <div className="text-xs text-ink leading-relaxed space-y-1">
                  <div>• <strong>Active Projection Lines:</strong> {selectedRepData.activeLines} items under monthly commitment.</div>
                  <div>• <strong>Hot Pipeline:</strong> {selectedRepData.hotDealsCount} high-probability deals valued at {inr(selectedRepData.hotDealsVal)}.</div>
                  <div>• <strong>Assigned Receivables:</strong> {inr(selectedRepData.outstanding)} outstanding collections.</div>
                  <div>• <strong>SLA Health:</strong> {selectedRepData.overdueFus > 0 ? `${selectedRepData.overdueFus} overdue follow-up actions required.` : "All customer follow-ups on schedule."}</div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRepId(null);
                  navigate(`/managements/${DEFAULT_MANAGEMENT_ID}/dashboard`);
                }}
                className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold shadow-xs hover:bg-brand-ink transition-colors cursor-pointer"
              >
                Inspect Management Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Management Modal ── */}
      <CreateManagementModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}
