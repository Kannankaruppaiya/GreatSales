import { useState } from "react";
import {
  ArrowLeft,
  Boxes,
  Building2,
  CalendarClock,
  ChevronRight,
  FileQuestion,
  HelpCircle,
  Home,
  LayoutDashboard,
  Receipt,
  Repeat,
  Search,
  ShoppingCart,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Card, PageHeader } from "../components/ui";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const modules = [
    {
      title: "Executive Dashboard",
      desc: "Live targets, conversion KPIs, and oral confirmations.",
      path: "/dashboard",
      icon: LayoutDashboard,
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      title: "Recurring Projections",
      desc: "Monthly SKU commitments, price matrix, and fulfillment.",
      path: "/projections",
      icon: Repeat,
      color: "text-amber-700 bg-amber-50 border-amber-200",
    },
    {
      title: "Sales Leads & Pipeline",
      desc: "Active deal stages, Kanban boards, and expected closures.",
      path: "/leads",
      icon: Target,
      color: "text-purple-700 bg-purple-50 border-purple-200",
    },
    {
      title: "Sales Orders & Dispatches",
      desc: "Order codes, warehouse dispatch, and fulfillment SLA analytics.",
      path: "/orders",
      icon: ShoppingCart,
      color: "text-blue-700 bg-blue-50 border-blue-200",
    },
    {
      title: "Payments & Debt Recovery",
      desc: "Aging buckets (0-150+ days), risk zones, and WhatsApp reminders.",
      path: "/payments",
      icon: Receipt,
      color: "text-rose-700 bg-rose-50 border-rose-200",
    },
    {
      title: "Actionable Timeline",
      desc: "Chronological agenda of overdue and upcoming follow-ups.",
      path: "/followups",
      icon: CalendarClock,
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
    },
    {
      title: "Customer Master Directory",
      desc: "Accounts list, tier categories, and Customer 360 view.",
      path: "/customers",
      icon: Building2,
      color: "text-teal-700 bg-teal-50 border-teal-200",
    },
    {
      title: "Product & Principal Catalog",
      desc: "Principal master chips and SKU list prices.",
      path: "/products",
      icon: Boxes,
      color: "text-cyan-700 bg-cyan-50 border-cyan-200",
    },
    {
      title: "Team & Governance",
      desc: "Salesperson portfolios, account reassignments, and roles.",
      path: "/users",
      icon: UsersRound,
      color: "text-slate-700 bg-slate-100 border-slate-200",
    },
  ];

  const filteredModules = searchQuery.trim()
    ? modules.filter(
        (m) =>
          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.path.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : modules;

  return (
    <div className="space-y-6">
      {/* Top Standard CRM Page Header */}
      <PageHeader
        title="Resource Not Found"
        subtitle={`The path "${location.pathname}" does not match any registered GreatSales CRM surface.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Previous Page
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate("/dashboard")}>
              <Home className="h-4 w-4 mr-1" /> Return to Dashboard
            </Button>
          </>
        }
      />

      {/* Hero Error & Search Banner (Watermelon UI / Shadcn Card Style) */}
      <Card className="relative overflow-hidden border-line shadow-card p-6 sm:p-8 bg-surface">
        {/* Subtle background dot pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-60" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-600 shadow-2xs">
              <FileQuestion className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                  404 ERROR
                </span>
                <span className="text-xs text-muted font-semibold">Unrecognized Route</span>
              </div>
              <h3 className="text-xl font-bold text-ink font-sans tracking-tight">
                Looking for a specific customer, product, or sales record?
              </h3>
              <p className="text-xs text-muted max-w-xl leading-relaxed">
                If you followed an outdated link or mistyped a customer code in the URL, search below or pick from one of the active CRM surfaces.
              </p>
            </div>
          </div>

          {/* Quick Search Box */}
          <div className="w-full md:w-80 shrink-0 space-y-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search CRM modules or views…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-2xs transition-all"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted px-1">
              <span>Press <kbd className="font-mono font-bold text-ink bg-surface border border-line px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd> for spotlight</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Suggested CRM Modules Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span>Available Operational Modules</span>
          </div>
          <span className="text-xs text-muted font-medium">{filteredModules.length} destinations</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredModules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.path}
                onClick={() => navigate(m.path)}
                className="rounded-2xl border border-line bg-surface p-4 shadow-card hover:shadow-card-hover hover:border-brand/50 hover:-translate-y-0.5 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className={`grid h-8 w-8 place-items-center rounded-xl border ${m.color} shadow-2xs`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-muted group-hover:text-brand transition-colors flex items-center gap-0.5">
                    Open <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>

                <div>
                  <div className="text-sm font-bold text-ink group-hover:text-brand transition-colors font-sans">
                    {m.title}
                  </div>
                  <div className="text-xs text-muted mt-0.5 leading-snug line-clamp-2">
                    {m.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Troubleshooting Guide Card */}
      <Card className="p-4 bg-surface-2/50 border-line text-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="h-4 w-4 text-muted shrink-0" />
          <span className="text-muted leading-relaxed">
            Need assistance or missing access permissions? Switch your persona in <b className="text-ink">Data & Tenant Governance</b> or contact your CRM Administrator.
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/data")}>
          Open Data & Tenant Settings
        </Button>
      </Card>
    </div>
  );
}
