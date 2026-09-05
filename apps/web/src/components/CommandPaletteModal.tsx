import { useEffect, useMemo, useState } from "react";
import { Boxes, Building2, Receipt, Search, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "@/components/ui";
import { inr } from "@/lib/format";
import { featuresFor, featurePath } from "@/data/features";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuthRole } from "@/store/auth";
import { useCustomers, flattenCustomers } from "@/features/customers/queries";
import { useProducts, flattenProducts } from "@/features/products/queries";
import { useOrders, flattenOrders } from "@/features/orders/queries";
import { usePayments, flattenPayments } from "@/features/payments/queries";
import { useLeads, flattenLeads } from "@/features/leads/queries";

export function CommandPaletteModal({
  open,
  onClose,
  onSelectCustomer,
}: {
  open: boolean;
  onClose: () => void;
  onSelectCustomer?: (customerId: string) => void;
}) {
  const navigate = useNavigate();
  const role = useAuthRole();
  const managementId = useUi((s) => s.activeManagementId) || DEFAULT_MANAGEMENT_ID;
  // Only the pages this role can actually reach — the palette used to offer
  // every page to everyone, so a sales user could jump into the admin surfaces.
  const pages = useMemo(
    () =>
      featuresFor(role).map((f) => ({
        label: f.paletteLabel,
        desc: f.paletteDesc,
        icon: f.icon,
        path: featurePath(f.key, managementId),
      })),
    [role, managementId],
  );
  const customersQ = useCustomers({}, { enabled: open });
  const productsQ = useProducts({}, { enabled: open });
  const ordersQ = useOrders({}, { enabled: open });
  const paymentsQ = usePayments({}, { enabled: open });
  const leadsQ = useLeads({}, { enabled: open });

  const customers = flattenCustomers(customersQ.data);
  const products = flattenProducts(productsQ.data);
  const orders = flattenOrders(ordersQ.data);
  const payments = flattenPayments(paymentsQ.data);
  const leads = flattenLeads(leadsQ.data);

  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Search Results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        pages,
        customers: customers.slice(0, 5),
        products: products.slice(0, 4),
        leads: leads.slice(0, 3),
        orders: orders.slice(0, 2),
        payments: payments.slice(0, 2),
      };
    }

    return {
      pages: pages.filter(
        (p) => p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q),
      ),

      customers: customers
        .filter((c) => c.name.toLowerCase().includes(q) || (c.area || "").toLowerCase().includes(q) || (c.primaryContactName || "").toLowerCase().includes(q))
        .slice(0, 8),

      products: products
        .filter((p) => p.name.toLowerCase().includes(q) || (p.principalName || "").toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q))
        .slice(0, 6),

      leads: leads
        .filter((l) => (l.customerName || "").toLowerCase().includes(q))
        .slice(0, 4),

      orders: orders
        .filter((o) => (o.code || "").toLowerCase().includes(q) || (o.customerName || "").toLowerCase().includes(q))
        .slice(0, 4),

      payments: payments
        .filter((p) => (p.refNo || "").toLowerCase().includes(q) || (p.customerName || "").toLowerCase().includes(q))
        .slice(0, 4),
    };
  }, [query, pages, customers, products, leads, orders, payments]);

  const handleGoPage = (path: string) => {
    navigate(path);
    onClose();
  };

  const handlePickCustomer = (cid: string) => {
    onClose();
    if (onSelectCustomer) {
      onSelectCustomer(cid);
    } else {
      navigate(featurePath("customers", managementId));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Universal Search & Spotlight" maxWidth="max-w-xl">
      <div className="-mt-3 -mx-6 -mb-6 space-y-0">
        {/* Search Header Input */}
        <div className="relative flex items-center border-b border-line px-4 py-3.5 bg-surface-2/40">
          <Search className="h-4.5 w-4.5 text-muted shrink-0 mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command, customer, product, or invoice…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-bold text-muted uppercase shadow-2xs">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4 text-xs">
          {/* Quick Pages */}
          {results.pages.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted px-2 mb-1.5">
                Navigation & Views
              </div>
              <div className="space-y-1">
                {results.pages.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.path}
                      onClick={() => handleGoPage(p.path)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-2 text-left cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-7 w-7 place-items-center rounded-lg bg-surface border border-line text-muted group-hover:text-brand group-hover:border-brand/40 transition-colors shadow-2xs">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-ink">{p.label}</div>
                          <div className="text-[11px] text-muted">{p.desc}</div>
                        </div>
                      </div>
                      <span className="text-[11px] text-brand font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        Go →
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customers */}
          {results.customers.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted px-2 mb-1.5">
                Customers ({results.customers.length})
              </div>
              <div className="space-y-1">
                {results.customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handlePickCustomer(c.id)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-2 text-left cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand-soft border border-brand/20 text-brand-ink shadow-2xs">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-ink">{c.name}</div>
                        <div className="text-[11px] text-muted">
                          {c.area || "General Area"} · {c.primaryContactName || "Direct"} · {c.primaryContactPhone || "—"}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-brand font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      Open 360 →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {results.products.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted px-2 mb-1.5">
                Products & Principals ({results.products.length})
              </div>
              <div className="space-y-1">
                {results.products.map((pr) => (
                  <button
                    key={pr.id}
                    onClick={() => handleGoPage(featurePath("products", managementId))}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-2 text-left cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-surface border border-line text-muted shadow-2xs">
                        <Boxes className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-ink">{pr.name}</div>
                        <div className="text-[11px] text-muted">
                          {pr.principalName} · SKU: {pr.sku || "—"}
                        </div>
                      </div>
                    </div>
                    <span className="font-bold text-ink tabular-nums text-xs">
                      {pr.basePrice != null ? inr(pr.basePrice) : "—"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Orders */}
          {results.orders.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted px-2 mb-1.5">
                Sales Orders
              </div>
              <div className="space-y-1">
                {results.orders.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => handleGoPage(featurePath("orders", managementId))}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-2 text-left cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-surface border border-line text-muted shadow-2xs">
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-ink">{o.code}</div>
                        <div className="text-[11px] text-muted">{o.customerName} · {o.status}</div>
                      </div>
                    </div>
                    <span className="font-bold text-brand tabular-nums text-xs">
                      {inr(o.total)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Invoices */}
          {results.payments.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted px-2 mb-1.5">
                Pending Invoices
              </div>
              <div className="space-y-1">
                {results.payments.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleGoPage(featurePath("payments", managementId))}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-2 text-left cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-surface border border-line text-muted shadow-2xs">
                        <Receipt className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-ink">{p.refNo}</div>
                        <div className="text-[11px] text-muted">{p.customerName} · Zone: {p.payZone}</div>
                      </div>
                    </div>
                    <span className="font-bold text-red tabular-nums text-xs">
                      {inr(p.amount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line px-4 py-2 bg-surface-2 flex items-center justify-between text-[11px] text-muted">
          <span>Use <kbd className="font-mono font-bold text-ink">↑</kbd> <kbd className="font-mono font-bold text-ink">↓</kbd> to navigate, <kbd className="font-mono font-bold text-ink">↵</kbd> to select</span>
          <span>GreatSales Enterprise Spotlight</span>
        </div>
      </div>
    </Dialog>
  );
}
