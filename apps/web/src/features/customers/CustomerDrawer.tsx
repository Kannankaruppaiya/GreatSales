import { useState } from "react";
import { Building2, MessageCircle, Phone, Trash2, X } from "lucide-react";
import { useAuthRole } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { Button, Skeleton } from "@/components/ui";
import { useCustomer, useDeleteCustomer } from "@/features/customers/queries";
import { useMappings } from "@/features/mappings/queries";
import { useOrders } from "@/features/orders/queries";
import { usePayments } from "@/features/payments/queries";
import { RemarksPanel } from "@/features/remarks/RemarksPanel";
import type { CustomerRow } from "@/features/customers/types";

/**
 * Customer 360 slide-over. Rendered from several pages (CustomersPage, the
 * global layout quick-view, Dashboard, FollowUps, Payments, the mock
 * Projections page) so its prop shape (`customerId: string | null`) stays
 * unchanged.
 *
 * When `customer` prop is passed directly (CustomersPage), it renders immediately.
 * Otherwise, when only `customerId` is provided (Payments, Dashboard, Global Quick-view),
 * it fetches the customer record directly via GET /customers/:id.
 */
export function CustomerDrawer({
  customerId,
  customer: customerProp,
  onClose,
}: {
  customerId: string | null;
  customer?: CustomerRow;
  onClose: () => void;
}) {
  const role = useAuthRole();
  const needsFetch = !customerProp && !!customerId;
  const q = useCustomer(customerId, { enabled: needsFetch });
  const del = useDeleteCustomer();

  // Related-record counts for the 360° block. `total` is the server's count for
  // the filter, so these are real totals rather than "however many fit on the
  // first page"; the rows themselves are not needed, only the counts.
  const relatedEnabled = !!customerId;
  const mappingsQ = useMappings(
    { customerId: customerId ?? undefined },
    { enabled: relatedEnabled },
  );
  const ordersQ = useOrders(
    { customerId: customerId ?? undefined },
    { enabled: relatedEnabled },
  );
  const paymentsQ = usePayments(
    { customerId: customerId ?? undefined },
    { enabled: relatedEnabled },
  );
  const [deleteError, setDeleteError] = useState("");

  const customer = customerProp ?? (needsFetch ? (q.data ?? null) : null);
  const isLoading = needsFetch && q.isLoading;
  const isError = needsFetch && q.isError;

  if (!customerId) return null;

  const phoneClean = (customer?.primaryContactPhone || "").replace(/[^0-9]/g, "");

  const handleDelete = async () => {
    if (!customer) return;
    if (!confirm(`Delete "${customer.name}"? This cannot be undone.`)) return;
    setDeleteError("");
    try {
      await del.mutateAsync(customer.id);
      onClose();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Failed to delete customer.");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-surface border-l border-line shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-red">Failed to load customer</span>
              <button
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted">
              {q.error instanceof ApiError ? q.error.message : "Something went wrong."}
            </p>
          </div>
        ) : !customer ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-ink">Customer not found</span>
              <button
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted">
              This account could not be loaded from the current page (it may not be in the loaded
              list, or this view has not been wired to the live data yet).
            </p>
          </div>
        ) : (
          <>
            {/* Drawer Header */}
            <div className="p-4 border-b border-line bg-surface-2/40 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft border border-brand/30 text-brand font-bold shadow-xs">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-ink truncate">{customer.name}</h3>
                    {customer.category && (
                      <span className="rounded px-2 py-0.5 text-[10.5px] font-bold bg-surface-2 text-ink border border-line">
                        {customer.category}
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        customer.active ? "bg-brand-soft text-brand-ink" : "bg-red-soft text-red"
                      }`}
                    >
                      {customer.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="text-xs text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>
                      Contact: <b className="text-ink">{customer.primaryContactName || "Direct"}</b>
                    </span>
                    <span>·</span>
                    <span>
                      Assigned: <b className="text-brand font-semibold">{customer.salespersonName}</b>
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Contact & Action Quick Bar */}
            <div className="px-4 py-2.5 bg-surface border-b border-line/60 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 text-xs">
                {customer.primaryContactPhone && (
                  <a
                    href={`tel:${customer.primaryContactPhone}`}
                    className="inline-flex items-center gap-1 text-muted hover:text-brand font-medium transition-colors"
                  >
                    <Phone className="h-3 w-3" /> {customer.primaryContactPhone}
                  </a>
                )}
                {phoneClean && (
                  <a
                    href={`https://wa.me/${phoneClean.startsWith("91") ? phoneClean : "91" + phoneClean}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
              </div>

              <div className="text-xs text-muted">
                Terms: <span className="font-semibold text-ink">{customer.paymentTerms || "—"}</span>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 gap-2 p-4 bg-surface-2/30 border-b border-line">
              <div
                className={`rounded-xl border p-2.5 text-center shadow-2xs ${
                  customer.outstanding > 0 ? "border-red/40 bg-red-soft" : "border-line bg-surface"
                }`}
              >
                <div
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    customer.outstanding > 0 ? "text-red" : "text-muted"
                  }`}
                >
                  Outstanding
                </div>
                <div
                  className={`text-sm font-bold mt-0.5 tabular-nums ${
                    customer.outstanding > 0 ? "text-red" : "text-ink"
                  }`}
                >
                  {customer.outstanding}
                </div>
              </div>
              <div className="rounded-xl border border-line bg-surface p-2.5 text-center shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Payment Risk Zone
                </div>
                <div className="text-sm font-bold text-ink mt-0.5">{customer.payZone || "—"}</div>
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-xs font-bold text-ink uppercase tracking-wider">
                Account Details
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 grid grid-cols-2 gap-y-2.5 gap-x-3 text-xs">
                <div>
                  <span className="text-muted text-[11px] block">Division</span>
                  <span className="font-semibold text-ink">{customer.division || "—"}</span>
                </div>
                <div>
                  <span className="text-muted text-[11px] block">Type</span>
                  <span className="font-semibold text-ink">{customer.type || "—"}</span>
                </div>
                <div>
                  <span className="text-muted text-[11px] block">Industry</span>
                  <span className="font-semibold text-ink">{customer.industryName || "—"}</span>
                </div>
                <div>
                  <span className="text-muted text-[11px] block">Sub-industry</span>
                  <span className="font-semibold text-ink">{customer.subIndustry || "—"}</span>
                </div>
                <div>
                  <span className="text-muted text-[11px] block">Territory / Area</span>
                  <span className="font-semibold text-ink">{customer.area || "—"}</span>
                </div>
                <div>
                  <span className="text-muted text-[11px] block">Collector</span>
                  <span className="font-semibold text-ink">{customer.collectorName || "—"}</span>
                </div>
              </div>

              {/* The 360° view. This was a "will appear here once those pages
                  are wired to the API" placeholder long after those pages were
                  wired — the three endpoints all take a customerId filter. */}
              <div className="grid grid-cols-3 gap-2">
                <RelatedStat label="Mapped SKUs" value={mappingsQ.data?.pages[0]?.total} />
                <RelatedStat label="Sales orders" value={ordersQ.data?.pages[0]?.total} />
                <RelatedStat label="Invoices" value={paymentsQ.data?.pages[0]?.total} />
              </div>

              <RemarksPanel
                entityType="Customer"
                entityId={customer.id}
                canWrite={role !== "mgmt"}
              />

              {role === "admin" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={del.isPending}
                  className="w-full text-red border-red/30 hover:bg-red-soft"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  {del.isPending ? "Deleting…" : "Delete Customer"}
                </Button>
              )}
              {deleteError && <p className="text-[11.5px] font-medium text-red">{deleteError}</p>}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** One related-record count. `undefined` means the query has not answered yet. */
function RelatedStat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-2.5 text-center">
      <div className="text-sm font-bold text-ink tabular-nums">
        {value ?? "…"}
      </div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
    </div>
  );
}
