/**
 * AppShell — the authenticated admin layout and route guard. Renders a
 * persistent sidebar on desktop and a dismissible drawer on small screens, a
 * topbar with the theme toggle, and the routed page via <Outlet/>. Redirects to
 * /login when there's no session, and holds a branded loader during bootstrap.
 *
 * The sidebar shows the two live destinations (Dashboard, Account) plus an
 * honest map of the admin modules still being built — disabled, marked "Soon",
 * never faked.
 */
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Menu,
  Settings,
  Shield,
  ShoppingCart,
  Target,
  TrendingUp,
  UserCircle,
  Users,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";

import { FullPageLoader } from "@/components/full-page-loader";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/cn";

type NavItem = { label: string; icon: LucideIcon; to?: string; end?: boolean };

const PRIMARY: NavItem[] = [{ label: "Dashboard", icon: LayoutDashboard, to: "/", end: true }];

const MODULES: NavItem[] = [
  { label: "Customers", icon: Users2 },
  { label: "Leads", icon: TrendingUp },
  { label: "Orders", icon: ShoppingCart },
  { label: "Payments", icon: CreditCard },
  { label: "Targets", icon: Target },
  { label: "Reports", icon: BarChart3 },
];

const ADMIN: NavItem[] = [
  { label: "Users", icon: Users },
  { label: "Teams & roles", icon: Shield },
  { label: "Settings", icon: Settings },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function ActiveLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  return (
    <NavLink
      to={item.to!}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-field px-3 py-2.5 text-[15px] font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          isActive
            ? "bg-primary-subtle text-primary"
            : "text-fg-secondary hover:bg-surface-sunken hover:text-fg",
        )
      }
    >
      <item.icon className="size-5 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  );
}

function DisabledLink({ item }: { item: NavItem }) {
  return (
    <div
      aria-disabled
      title="Coming soon"
      className="flex items-center gap-3 rounded-field px-3 py-2.5 text-[15px] font-medium text-fg-muted"
    >
      <item.icon className="size-5 shrink-0" aria-hidden />
      <span className="flex-1">{item.label}</span>
      <Badge label="Soon" tone="neutral" />
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <Text variant="caption" color="muted" className="uppercase tracking-wider">
        {children}
      </Text>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const { user, signOut } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Text variant="h3" color="link">
          GreatSales
        </Text>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Primary">
        {PRIMARY.map((item) => (
          <ActiveLink key={item.label} item={item} onNavigate={onNavigate} />
        ))}
        <ActiveLink item={{ label: "Account", icon: UserCircle, to: "/account" }} onNavigate={onNavigate} />

        <SectionLabel>Modules</SectionLabel>
        {MODULES.map((item) => (
          <DisabledLink key={item.label} item={item} />
        ))}

        <SectionLabel>Administration</SectionLabel>
        {ADMIN.map((item) => (
          <DisabledLink key={item.label} item={item} />
        ))}
      </nav>

      <div className="border-t border-divider p-3">
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-subtle">
            <Text variant="bodySm" color="link" className="font-semibold">
              {user ? initials(user.name) : "…"}
            </Text>
          </div>
          <div className="min-w-0 flex-1">
            {user ? (
              <>
                <Text variant="bodySm" color="primary" className="block truncate font-semibold">
                  {user.name}
                </Text>
                {user.role ? (
                  <span className="mt-0.5 inline-block">
                    <Badge label={user.role} tone="primary" />
                  </span>
                ) : null}
              </>
            ) : (
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            )}
          </div>
        </div>
        <Button variant="secondary" fullWidth onClick={signOut} className="mt-2">
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function AppShell() {
  const { status } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setNavOpen(false), [location.pathname]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  if (status === "loading") return <FullPageLoader />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-divider bg-surface lg:block">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {/* Mobile drawer */}
      {navOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--overlay)]"
            onClick={() => setNavOpen(false)}
            aria-hidden
          />
          <aside
            className="absolute inset-y-0 left-0 w-72 border-r border-divider bg-surface shadow-pop"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <SidebarContent onNavigate={() => setNavOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-divider bg-surface/95 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="grid size-10 place-items-center rounded-field border border-border text-fg-secondary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="flex-1" />
          <ThemeToggle />
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
