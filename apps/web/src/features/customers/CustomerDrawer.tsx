import { useState, type ReactNode } from "react";
import { Building2, Check, MapPin, MessageCircle, Phone, Plus, Share2, Trash2, X } from "lucide-react";
import { mapsUrl, shareLocationUrl } from "./LocationField";
import { useAuthRole } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { inr, shortDate } from "@/lib/format";
import { Badge, Button, Skeleton } from "@/components/ui";
import { useCustomer, useDeleteCustomer } from "@/features/customers/queries";
import { useMappings } from "@/features/mappings/queries";
import { useOrders } from "@/features/orders/queries";
import { ORDER_STATUS_LABELS } from "@/features/orders/types";
import { usePayments } from "@/features/payments/queries";
import { PAYMENT_STATUS_LABELS } from "@/features/payments/types";
import { useFollowUps, flattenFollowUps, useUpdateFollowUp } from "@/features/followups/queries";
import { FollowUpModal } from "@/features/followups/FollowUpModal";
import { RemarksPanel } from "@/features/remarks/RemarksPanel";
import { AttachmentsPanel } from "@/features/attachments/AttachmentsPanel";
import {
  PAY_ZONE_LABELS,
  type PayZoneValue,
  type CustomerRow,
} from "@/features/customers/types";

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
  // Not a count-only query like the three above — a Customer's follow-ups
  // aren't shown anywhere else in the console today, so this section is the
  // only view of them, not a summary of a fuller one.
  const followUpsQ = useFollowUps(
    { entityType: "Customer", entityId: customerId ?? undefined },
    { enabled: relatedEnabled },
  );
  const followUps = flattenFollowUps(followUpsQ.data);
  const markFollowUpDone = useUpdateFollowUp();
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [locationStatus, setLocationStatus] = useState<"copied" | "failed" | null>(null);

  const customer = customerProp ?? (needsFetch ? (q.data ?? null) : null);
  const isLoading = needsFetch && q.isLoading;
  const isError = needsFetch && q.isError;

  if (!customerId) return null;

  const phoneClean = (customer?.primaryContactPhone || "").replace(/[^0-9]/g, "");
  const locationUrl =
    customer?.locationUrl ?? mapsUrl(customer?.latitude, customer?.longitude);
  const shareLocation = async () => {
    if (!locationUrl) return;
    const result = await shareLocationUrl(
      locationUrl,
      `${customer?.name ?? "Customer"} — location`,
    );
    // "Link copied" would be a lie if the clipboard refused. The Location link
    // beside this button is the way out either way.
    setLocationStatus(result === "failed" ? "failed" : "copied");
    setTimeout(() => setLocationStatus(null), 2000);
  };

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
                {locationUrl && (
                  <>
                    <a
                      href={locationUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-muted hover:text-brand font-medium transition-colors"
                    >
                      <MapPin className="h-3 w-3" /> Location
                    </a>
                    {/* The driver's copy. This is why the pin exists, so it
                        belongs next to the phone number rather than behind an
                        edit form. */}
                    <button
                      type="button"
                      onClick={shareLocation}
                      className="inline-flex items-center gap-1 text-muted hover:text-brand font-medium transition-colors cursor-pointer"
                    >
                      {locationStatus === "copied" ? (
                        <>
                          <Check className="h-3 w-3" /> Link copied
                        </>
                      ) : locationStatus === "failed" ? (
                        <>
                          <Share2 className="h-3 w-3" /> Copy blocked
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3 w-3" /> Share
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>

              <div className="text-xs text-muted">
                Terms: <span className="font-semibold text-ink">{customer.paymentTerms || "—"}</span>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 gap-2.5 p-4 bg-surface-2/30 border-b border-line">
              <div
                className={`rounded-xl border p-3 text-center shadow-2xs ${
                  customer.outstanding > 0 ? "border-red/40 bg-red-soft" : "border-line bg-surface"
                }`}
              >
                <div
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    customer.outstanding > 0 ? "text-red" : "text-muted"
                  }`}
                >
                  Outstanding Balance
                </div>
                <div
                  className={`text-base font-extrabold mt-0.5 tabular-nums ${
                    customer.outstanding > 0 ? "text-red" : "text-ink"
                  }`}
                >
                  {inr(customer.outstanding)}
                </div>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 text-center shadow-2xs flex flex-col justify-center items-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                  Payment Risk Zone
                </div>
                {customer.payZone ? (
                  <Badge
                    variant={
                      customer.payZone === "GreenZone"
                        ? "good"
                        : customer.payZone === "YellowZone"
                          ? "warn"
                          : customer.payZone === "RedZone"
                            ? "bad"
                            : "default"
                    }
                    dot
                  >
                    {PAY_ZONE_LABELS[customer.payZone as PayZoneValue] || customer.payZone}
                  </Badge>
                ) : (
                  <span className="text-xs font-semibold text-muted">—</span>
                )}
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
                  wired — the endpoints below all take a customerId filter
                  (follow-ups take entityType/entityId instead, the same shape
                  Payments and Projections already use for their own panels).

                  Leads and Projections/targets are NOT shown here: a Lead has
                  no customerId (it carries a free-text `customerName` until it
                  converts — packages/db/prisma/schema.prisma `model Lead`), and
                  a Projection is scoped by Mapping, not Customer, directly.
                  Matching either one back to this customer would mean a
                  name match, which is exactly the kind of guess a 360 view
                  must not present as fact. The Leads and Projections pages
                  can still be searched by customer name directly. */}
              <div className="grid grid-cols-3 gap-2">
                <RelatedStat label="Mapped SKUs" value={mappingsQ.data?.pages[0]?.total} />
                <RelatedStat label="Sales orders" value={ordersQ.data?.pages[0]?.total} />
                <RelatedStat label="Invoices" value={paymentsQ.data?.pages[0]?.total} />
              </div>

              {customer.contacts.length > 0 && (
                <RelatedSection title="Contacts" count={customer.contacts.length}>
                  {customer.contacts.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/60 p-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-ink truncate">
                          {c.name}
                          {c.isPrimary && (
                            <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-3xs font-bold text-brand-ink">
                              Primary
                            </span>
                          )}
                        </div>
                        {c.designation && <div className="text-3xs text-muted">{c.designation}</div>}
                      </div>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="shrink-0 text-brand font-semibold">
                          {c.phone}
                        </a>
                      )}
                    </div>
                  ))}
                </RelatedSection>
              )}

              <RelatedSection
                title="Product mappings"
                count={mappingsQ.data?.pages[0]?.total}
                emptyLabel="No products mapped to this account yet."
              >
                {(mappingsQ.data?.pages[0]?.items ?? []).slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/60 p-2">
                    <span className="min-w-0 truncate font-semibold text-ink">{m.productName}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {m.effectivePrice == null ? "No price" : inr(m.effectivePrice)}
                    </span>
                  </div>
                ))}
              </RelatedSection>

              <RelatedSection
                title="Sales orders"
                count={ordersQ.data?.pages[0]?.total}
                emptyLabel="No sales orders for this account yet."
              >
                {(ordersQ.data?.pages[0]?.items ?? []).slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/60 p-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink truncate">{o.code}</div>
                      <div className="text-3xs text-muted">{shortDate(o.date)} · {ORDER_STATUS_LABELS[o.status as keyof typeof ORDER_STATUS_LABELS] ?? o.status}</div>
                    </div>
                    <span className="shrink-0 tabular-nums font-semibold text-ink">{inr(o.total)}</span>
                  </div>
                ))}
              </RelatedSection>

              <RelatedSection
                title="Invoices"
                count={paymentsQ.data?.pages[0]?.total}
                emptyLabel="No invoices for this account yet."
              >
                {(paymentsQ.data?.pages[0]?.items ?? []).slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/60 p-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink truncate">{p.refNo || p.invoiceNo || "—"}</div>
                      <div className="text-3xs text-muted">{PAYMENT_STATUS_LABELS[p.status as keyof typeof PAYMENT_STATUS_LABELS] ?? p.status}</div>
                    </div>
                    <span className={`shrink-0 tabular-nums font-semibold ${p.pending > 0 ? "text-red" : "text-ink"}`}>
                      {inr(p.pending)} due
                    </span>
                  </div>
                ))}
              </RelatedSection>

              <RelatedSection
                title="Follow-ups"
                count={followUpsQ.data?.pages[0]?.total}
                emptyLabel="No follow-ups logged for this account yet."
                action={
                  <button
                    type="button"
                    onClick={() => setShowAddFollowUp(true)}
                    className="inline-flex items-center gap-1 text-3xs font-bold uppercase tracking-wider text-brand hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                }
              >
                {followUps.slice(0, 5).map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/60 p-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink truncate">{f.title || "Follow-up"}</div>
                      <div className="text-3xs text-muted">Due {shortDate(f.dueDate)}</div>
                    </div>
                    {f.done ? (
                      <span className="shrink-0 text-3xs font-bold uppercase tracking-wider text-muted">Done</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markFollowUpDone.mutate({ id: f.id, patch: { done: true } })}
                        disabled={markFollowUpDone.isPending}
                        className="shrink-0 text-3xs font-bold uppercase tracking-wider text-brand hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Mark done
                      </button>
                    )}
                  </div>
                ))}
              </RelatedSection>

              <AttachmentsPanel
                entityType="Customer"
                entityId={customer.id}
                canWrite={role !== "mgmt"}
              />

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

      {customer && showAddFollowUp && (
        <FollowUpModal
          open={showAddFollowUp}
          onClose={() => setShowAddFollowUp(false)}
          defaults={{
            entityType: "Customer",
            entityId: customer.id,
            subtitle: customer.name,
          }}
        />
      )}
    </>
  );
}

/** One related-record count. `undefined` means the query has not answered yet. */
function RelatedStat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5 text-center shadow-2xs">
      <div className="text-base font-extrabold text-ink tabular-nums font-sans">
        {value ?? "…"}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted mt-0.5">
        {label}
      </div>
    </div>
  );
}

/**
 * One 360° block: a title with the server's true count, an optional action
 * (e.g. "Add"), and up to a handful of rows — loading/empty states included
 * so a slow or empty relation never just renders as a gap in the drawer.
 */
function RelatedSection({
  title,
  count,
  emptyLabel,
  action,
  children,
}: {
  title: string;
  count?: number;
  emptyLabel?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const rows = Array.isArray(children) ? children : [children];
  const hasRows = rows.some(Boolean);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-ink uppercase tracking-wider">
          {title}
          {count !== undefined && <span className="ml-1 font-medium text-muted normal-case">({count})</span>}
        </span>
        {action}
      </div>
      <div className="space-y-1.5 text-xs">
        {hasRows ? children : <p className="text-2xs text-muted">{emptyLabel ?? "Nothing here yet."}</p>}
      </div>
    </div>
  );
}
