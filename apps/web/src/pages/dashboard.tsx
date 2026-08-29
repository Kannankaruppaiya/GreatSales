/**
 * Dashboard — the authenticated landing. Shows the real signed-in identity from
 * `/auth/me` and an honest map of the admin modules being built. No fabricated
 * KPIs: the backend endpoints for customers/leads/orders/etc. don't exist yet,
 * so those are shown as disabled "coming soon" cards, not faked numbers.
 */
import {
  BarChart3,
  CreditCard,
  ShoppingCart,
  Target,
  TrendingUp,
  Users2,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth/auth-context";

const MODULES: { title: string; description: string; icon: LucideIcon }[] = [
  { title: "Customers", description: "Accounts, contacts, and reassignment", icon: Users2 },
  { title: "Leads", description: "Pipeline across the 9 deal stages", icon: TrendingUp },
  { title: "Orders", description: "Sales orders and status history", icon: ShoppingCart },
  { title: "Payments", description: "Invoices, aging, and collections", icon: CreditCard },
  { title: "Targets", description: "Target vs committed vs achieved", icon: Target },
  { title: "Reports", description: "Dashboards and drill-down analytics", icon: BarChart3 },
];

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function DashboardPage() {
  const { user, profileStatus, reloadProfile } = useAuth();

  if (!user && profileStatus === "loading") return <LoadingState label="Loading your workspace…" />;
  if (!user) {
    return (
      <ErrorState
        title="Couldn’t load your workspace"
        description="We couldn’t reach the server. Check your connection and try again."
        onRetry={reloadProfile}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Text variant="bodySm" color="muted">
          Welcome back
        </Text>
        <Text variant="h1" as="h1">
          {firstName(user.name)}
        </Text>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Text variant="h3" as="h2" className="block truncate">
              {user.name}
            </Text>
            <Text variant="bodySm" color="secondary">
              {user.email}
            </Text>
          </div>
          {user.role ? <Badge label={user.role} tone="primary" /> : null}
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <Text variant="label" color="secondary" className="uppercase tracking-wider">
          Your workspace
        </Text>
        <Banner
          tone="info"
          message="These modules are being built. You’re seeing the finished design ahead of the data."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Card key={m.title} className="flex flex-col gap-3 opacity-90">
              <div className="flex items-center justify-between">
                <div className="grid size-10 place-items-center rounded-field bg-primary-subtle">
                  <m.icon className="size-5 text-primary" aria-hidden />
                </div>
                <Badge label="Soon" tone="neutral" />
              </div>
              <div>
                <Text variant="bodyLg" className="font-semibold">
                  {m.title}
                </Text>
                <Text variant="bodySm" color="secondary" className="mt-0.5 block">
                  {m.description}
                </Text>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
