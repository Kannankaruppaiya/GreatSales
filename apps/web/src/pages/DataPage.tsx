import { useState } from "react";
import {
  Boxes,
  Building2,
  CheckCircle2,
  Database,
  Lock,
  Receipt,
  RefreshCw,
  Repeat,
  ShoppingCart,
  Target,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useTrackerStore } from "@/store/trackerStore";
import { Button, Card, CardHeader, MetricCard, PageHeader } from "@/components/ui";
import { roleLabel } from "@/data/constants";
import { useAuthRole } from "@/store/auth";
import { useMockOwnerId } from "@/lib/mockOwner";

export default function DataPage() {
  const role = useAuthRole();
  const ownerId = useMockOwnerId();
  const {
    customers,
    products,
    projections,
    leads,
    orders,
    payments,
    users,
    resetToSampleData,
    clearAllData,
  } = useTrackerStore();

  const [periodLocked, setPeriodLocked] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const me = users.find((u) => u.id === ownerId) || users[0];

  const handleResetSeed = () => {
    if (confirm("Reset application to standard demo dataset? All manual edits will be refreshed to POC baseline.")) {
      resetToSampleData();
      setStatusMessage("Demo dataset successfully restored to initial state.");
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleClearAll = () => {
    clearAllData();
    setShowClearConfirm(false);
    setStatusMessage("All operational data cleared. You have a clean blank slate.");
    setTimeout(() => setStatusMessage(null), 3500);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        title="Data & Tenant Governance"
        subtitle="System settings, local reactive state metrics, session role, and database management"
      />

      {/* Status banner */}
      {statusMessage && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-xs animate-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Dataset Statistics Matrix */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-brand" />
          <span>Reactive Local Storage State</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            title="Customers"
            value={`${customers.length}`}
            subvalue="accounts"
            icon={Building2}
            accentColor="brand"
          />
          <MetricCard
            title="Products"
            value={`${products.length}`}
            subvalue="active SKUs"
            icon={Boxes}
            accentColor="blue"
          />
          <MetricCard
            title="Projections"
            value={`${projections.length}`}
            subvalue="recurring items"
            icon={Repeat}
            accentColor="amber"
          />
          <MetricCard
            title="Sales Leads"
            value={`${leads.length}`}
            subvalue="pipeline deals"
            icon={Target}
            accentColor="violet"
          />
          <MetricCard
            title="Orders"
            value={`${orders.length}`}
            subvalue="dispatches"
            icon={ShoppingCart}
            accentColor="brand"
          />
          <MetricCard
            title="Invoices"
            value={`${payments.length}`}
            subvalue="receivables"
            icon={Receipt}
            accentColor="red"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Active Session Role (read-only — derived from the signed-in JWT) */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Active Session Persona"
            hint="Determined by your signed-in account role"
          />
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-ink uppercase tracking-wider block mb-1.5">
                Current Access Role
              </label>
              <div className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-bold text-ink">
                {roleLabel(role)}
              </div>
            </div>

            <div className="rounded-xl bg-surface-2 p-3.5 border border-line text-xs space-y-1.5">
              <div className="font-bold text-ink flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-brand" />
                <span>Simulated Profile: {me?.name || "Admin"}</span>
              </div>
              <p className="text-muted leading-relaxed font-medium">
                {role === "admin" && "Full administrative control: add/edit SKUs, reassign accounts, manage users & edit cells."}
                {role === "mgmt" && "Management Read-Only view: executive visibility across pipeline, metrics & exports with protected worksheets."}
                {role === "sales" && "Salesperson Scope: view and update records assigned to your sales portfolio."}
              </p>
            </div>
          </div>
        </Card>

        {/* Period Governance */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Period Locking & Audit Governance"
            hint="Freeze historical months to prevent unauthorized projection adjustments"
          />
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-surface-2">
              <div className="flex items-center gap-2.5">
                <Lock className={`h-4 w-4 ${periodLocked ? "text-amber" : "text-muted"}`} />
                <div>
                  <div className="font-bold text-ink text-xs font-sans">
                    {periodLocked ? "Period is Locked" : "Period is Open for Edits"}
                  </div>
                  <div className="text-[11px] text-muted font-medium">
                    {periodLocked ? "Projections are read-only for all users" : "Sales team can edit quantities & prices"}
                  </div>
                </div>
              </div>
              <Button
                variant={periodLocked ? "primary" : "outline"}
                size="sm"
                onClick={() => setPeriodLocked(!periodLocked)}
              >
                {periodLocked ? "Unlock Period" : "Lock Period"}
              </Button>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 leading-relaxed font-medium">
              Locking a period preserves projection targets for board reporting and blocks field overrides after the 5th of each month.
            </div>
          </div>
        </Card>
      </div>

      {/* Database Maintenance & Reset */}
      <Card className="overflow-hidden border-rose-200">
        <CardHeader
          title="Database Maintenance & Demo Seed"
          hint="Backup, reset or clean operational data stored in your browser"
        />
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-bold text-ink text-xs">Sample Demonstration Dataset</div>
            <div className="text-xs text-muted font-medium mt-0.5">
              Reset all modifications back to the original GreatSales POC v6 baseline data.
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={handleResetSeed}>
              <RefreshCw className="h-4 w-4 mr-1 text-brand" /> Reset to Demo Seed
            </Button>
            {!showClearConfirm ? (
              <Button variant="danger" size="sm" onClick={() => setShowClearConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Clear Database
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 p-1.5 rounded-lg border border-rose-300">
                <span className="text-xs font-bold text-rose-800 px-1">Are you sure?</span>
                <Button variant="danger" size="sm" onClick={handleClearAll}>
                  Yes, Clear All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowClearConfirm(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
