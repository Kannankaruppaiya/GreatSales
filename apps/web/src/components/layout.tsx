import { useEffect, useState } from "react";
import {
  Bell,
  Boxes,
  Building2,
  CalendarClock,
  ChevronDown,
  Database,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Repeat,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { NAVS, MONTHS, roleLabel } from "@/data/constants";
import { useUi } from "@/store/ui";
import { useAuthRole, useAuthUser, useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";
import { Avatar, Badge, Select } from "@/components/ui";
import { CommandPaletteModal } from "@/components/CommandPaletteModal";
import { ManagementSwitcher } from "@/features/management/ManagementSwitcher";
import { CustomerDrawer } from "@/features/customers/CustomerDrawer";
import { ToastContainer } from "@/components/Toast";
import { AddCustomerModal } from "@/features/customers/AddCustomerModal";
import { AddLeadModal } from "@/features/leads/AddLeadModal";
import { AddPaymentModal } from "@/features/payments/AddPaymentModal";
import { CreateSalesOrderModal } from "@/features/orders/CreateSalesOrderModal";
import { useFollowUps, flattenFollowUps } from "@/features/followups/queries";
import { usePayments, flattenPayments } from "@/features/payments/queries";
import { usePrincipals } from "@/features/products/queries";
import { useUsers, flattenUsers } from "@/features/users/queries";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  projections: Repeat,
  leads: Target,
  orders: ShoppingCart,
  payments: Receipt,
  followups: CalendarClock,
  customers: Building2,
  products: Boxes,
  mappings: Link2,
  users: UsersRound,
  data: Database,
};

export function Sidebar({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebar, activeManagementId } = useUi();
  const role = useAuthRole();
  const user = useAuthUser();
  const logout = useAuth((s) => s.logout);

  // Live follow-ups query from PostgreSQL
  const followUpsQ = useFollowUps({ done: false });
  const pendingFollowUps = flattenFollowUps(followUpsQ.data);

  const handleLogout = async () => {
    // Await it: logout revokes the session server-side, and navigating first
    // would leave that revocation racing an unmount.
    await logout();
    navigate("/login");
  };
  const nav = NAVS[role] ?? NAVS.admin ?? [];

  // Calculate overdue follow-ups count for live notification badge
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueCount = pendingFollowUps.filter(
    (f) => f.dueDate && f.dueDate < todayStr,
  ).length;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs transition-opacity lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setSidebar(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface shadow-xs transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line/70 bg-surface-2/40">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-emerald-800 text-white font-extrabold shadow-md shadow-brand/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="leading-tight min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-extrabold text-ink tracking-tight font-sans">GreatSales</span>
              <span className="rounded bg-brand-soft px-1.5 py-0.2 text-[10px] font-bold text-brand-ink border border-brand/20">
                PRO
              </span>
            </div>
            <div className="text-[11px] font-semibold text-muted tracking-tight truncate">
              {roleLabel(role)} Control
            </div>
          </div>
        </div>

        {/* Universal Quick Search Trigger */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-surface-2 border border-line hover:border-brand/40 text-muted hover:text-ink text-xs transition-all shadow-2xs group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted group-hover:text-brand transition-colors" />
              <span>Search anything…</span>
            </div>
            <kbd className="font-mono text-[10px] font-bold bg-surface border border-line px-1.5 py-0.2 rounded text-muted">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted/70">
            Operations & Analytics
          </div>
          {nav.map((n) => {
            const Icon = ICONS[n.key] ?? LayoutDashboard;
            const isFollowups = n.key === "followups";

            return (
              <NavLink
                key={n.key}
                to={`/managements/${activeManagementId}/${n.key}`}
                onClick={() => window.innerWidth < 1024 && setSidebar(false)}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium transition-all group",
                    isActive
                      ? "bg-brand-soft text-brand-ink font-bold shadow-2xs before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-brand"
                      : "text-muted hover:bg-surface-2 hover:text-ink",
                  )
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                  <span>{n.label}</span>
                </div>
                {isFollowups && overdueCount > 0 && (
                  <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-red text-[10px] font-bold text-white px-1 shadow-xs">
                    {overdueCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="border-t border-line/80 p-3 bg-surface-2/40">
          <div className="flex items-center gap-2.5 rounded-xl p-2 bg-surface border border-line shadow-xs">
            <Avatar name={user?.name ?? "User"} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-ink leading-none">{user?.name}</div>
              <div className="truncate text-[11px] text-muted font-medium mt-0.5">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-red-soft hover:text-red transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

const TITLES: Record<string, string> = {
  dashboard: "Executive Overview",
  projections: "Recurring Sales Projections",
  leads: "New Sales Pipeline & Leads",
  orders: "Sales Order Fulfillment",
  payments: "Payments & Receivables Follow-up",
  followups: "Actionable Timeline",
  customers: "Customer Master Directory",
  products: "Product & Principal Catalog",
  mappings: "Customer & Product Mapping",
  users: "Team & User Governance",
  data: "Data Administration & Periods",
};

export function Topbar({
  onOpenCommandPalette,
  onOpenQuickCreate,
}: {
  onOpenCommandPalette: () => void;
  onOpenQuickCreate: (type: "customer" | "lead" | "order" | "invoice") => void;
}) {
  const {
    month,
    principalId,
    ownerFilter,
    setMonth,
    setPrincipal,
    setOwnerFilter,
    toggleSidebar,
  } = useUi();
  const role = useAuthRole();

  // Live queries from backend API
  const principalsQ = usePrincipals();
  const principals = principalsQ.data?.items ?? [];

  const usersQ = useUsers();
  const users = flattenUsers(usersQ.data);
  const salespeople = users.filter(
    (u) => u.roleId === "role_sales" || u.roleName?.toLowerCase().includes("sales"),
  );

  const followUpsQ = useFollowUps({ done: false });
  const pendingFollowUps = flattenFollowUps(followUpsQ.data);

  const paymentsQ = usePayments();
  const payments = flattenPayments(paymentsQ.data);

  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const segs = useLocation().pathname.split("/").filter(Boolean);
  const key = segs[segs.length - 1] || "dashboard";

  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueFollowUps = pendingFollowUps.filter(
    (f) => f.dueDate && f.dueDate < todayStr,
  );
  const redZonePayments = payments.filter((p) => p.payZone === "RedZone");
  const totalAlerts = overdueFollowUps.length + redZonePayments.length;

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2.5 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur-md sm:px-6">
      <button
        onClick={toggleSidebar}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 lg:hidden border border-line cursor-pointer"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      <ManagementSwitcher />

      <div className="mr-auto">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted hidden sm:inline">
            GreatSales
          </span>
          <span className="text-muted/40 hidden sm:inline">/</span>
          <h2 className="text-[15px] font-bold text-ink tracking-tight font-sans">
            {TITLES[key] ?? "GreatSales"}
          </h2>
          {role === "mgmt" && (
            <Badge variant="warn" className="text-[10px] font-bold py-0.5">
              <ShieldCheck className="h-3 w-3 mr-0.5" /> Read-Only Mode
            </Badge>
          )}
        </div>
      </div>

      {/* Global Action & Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Quick Search Button */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg border border-line bg-surface-2 hover:border-brand/40 text-muted hover:text-ink text-xs transition-colors cursor-pointer"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-muted">Search (⌘K)</span>
        </button>

        {/* Quick Create Dropdown */}
        {role !== "mgmt" && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowQuickMenu(!showQuickMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {showQuickMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowQuickMenu(false)} />
                <div className="absolute right-0 mt-1 z-30 w-48 rounded-xl border border-line bg-surface p-1.5 shadow-xl text-xs space-y-0.5 animate-in fade-in">
                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenQuickCreate("customer");
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-ink hover:bg-surface-2 hover:text-brand font-medium text-left cursor-pointer transition-colors"
                  >
                    <Building2 className="h-3.5 w-3.5 text-muted" /> Add Customer
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenQuickCreate("lead");
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-ink hover:bg-surface-2 hover:text-brand font-medium text-left cursor-pointer transition-colors"
                  >
                    <Target className="h-3.5 w-3.5 text-muted" /> Add New Sales Lead
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenQuickCreate("order");
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-ink hover:bg-surface-2 hover:text-brand font-medium text-left cursor-pointer transition-colors"
                  >
                    <ShoppingCart className="h-3.5 w-3.5 text-muted" /> Create Sales Order
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenQuickCreate("invoice");
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-ink hover:bg-surface-2 hover:text-brand font-medium text-left cursor-pointer transition-colors"
                  >
                    <Receipt className="h-3.5 w-3.5 text-muted" /> Log Invoice
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Notifications Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface hover:bg-surface-2 text-muted hover:text-ink transition-colors cursor-pointer"
            title="Notifications & Alerts"
          >
            <Bell className="h-4 w-4" />
            {totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red text-[9px] font-bold text-white grid place-items-center ring-2 ring-surface">
                {totalAlerts > 9 ? "9+" : totalAlerts}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowNotifMenu(false)} />
              <div className="absolute right-0 mt-1 z-30 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl text-xs space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between font-bold text-ink border-b border-line pb-1.5">
                  <span>Urgent Alerts & Action Items</span>
                  <span className="text-[10px] font-bold text-muted">{totalAlerts} items</span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {overdueFollowUps.slice(0, 4).map((f) => (
                    <div key={f.id} className="p-2 rounded-lg bg-amber-soft border border-amber/20 text-amber text-[11.5px] space-y-0.5">
                      <div className="font-bold">{f.note || "Pending Follow-Up"}</div>
                      <div className="text-[10.5px] text-amber/80 truncate">Due date was {f.dueDate} ({f.entityType})</div>
                    </div>
                  ))}

                  {redZonePayments.slice(0, 3).map((pmt) => (
                    <div key={pmt.id} className="p-2 rounded-lg bg-red-soft border border-red/20 text-red text-[11.5px] space-y-0.5">
                      <div className="font-bold">Red Zone Overdue: {pmt.customerName}</div>
                      <div className="text-[10.5px] text-red/80">Ref: {pmt.refNo}</div>
                    </div>
                  ))}

                  {totalAlerts === 0 && (
                    <div className="py-6 text-center text-muted text-xs">
                      All caught up! No overdue alerts.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Month selector */}
        <Select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Filter by month"
          className="w-[125px] h-8 text-xs font-bold"
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>

        {/* Principal selector */}
        <Select
          value={principalId}
          onChange={(e) => setPrincipal(e.target.value)}
          aria-label="Filter by principal brand"
          className="w-[135px] h-8 text-xs font-semibold"
        >
          <option value="ALL">All Principals ({principals.length})</option>
          {principals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        {/* Salesperson selector */}
        {role !== "sales" && (
          <Select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            aria-label="Filter by salesperson"
            className="w-[150px] h-8 text-xs font-semibold"
          >
            <option value="ALL">All Salespersons</option>
            {salespeople.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </div>
    </header>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [selectedDrawerCustomerId, setSelectedDrawerCustomerId] = useState<string | null>(null);

  // Quick Create Modal States
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);

  // Keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleQuickCreate = (type: "customer" | "lead" | "order" | "invoice") => {
    if (type === "customer") setShowAddCustomer(true);
    if (type === "lead") setShowAddLead(true);
    if (type === "order") setShowCreateOrder(true);
    if (type === "invoice") setShowAddPayment(true);
  };

  return (
    <div className="min-h-screen bg-bg font-sans text-ink antialiased">
      <Sidebar onOpenCommandPalette={() => setShowCommandPalette(true)} />

      <div className="flex flex-1 flex-col lg:pl-64">
        <Topbar
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          onOpenQuickCreate={handleQuickCreate}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
          {children}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPaletteModal
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onSelectCustomer={(cid) => setSelectedDrawerCustomerId(cid)}
      />

      {/* Global Quick View Customer Drawer */}
      <CustomerDrawer
        customerId={selectedDrawerCustomerId}
        onClose={() => setSelectedDrawerCustomerId(null)}
      />

      {/* Global Quick Create Modals */}
      <AddCustomerModal
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
      />

      <AddLeadModal
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
      />

      <AddPaymentModal
        open={showAddPayment}
        onClose={() => setShowAddPayment(false)}
      />

      <CreateSalesOrderModal
        open={showCreateOrder}
        onClose={() => setShowCreateOrder(false)}
      />

      <ToastContainer />
    </div>
  );
}
