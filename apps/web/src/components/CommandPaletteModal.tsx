import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  CalendarClock,
  LayoutDashboard,
  Receipt,
  Repeat,
  Search,
  ShoppingCart,
  Target,
  UsersRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "./ui";
import { useTrackerStore } from "../store/trackerStore";
import { inr } from "../lib/format";

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
  const { customers, products, leads, orders, payments } = useTrackerStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Search Results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        pages: [
          { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", desc: "Executive metrics & performance" },
          { label: "Projections", icon: Repeat, path: "/projections", desc: "Recurring sales worksheet & commitments" },
          { label: "New Sales Pipeline", icon: Target, path: "/leads", desc: "Leads & deal stages kanban" },
          { label: "Sales Orders", icon: ShoppingCart, path: "/orders", desc: "Order fulfillment & dispatch tracking" },
          { label: "Payments Follow-Up", icon: Receipt, path: "/payments", desc: "Aging invoices & credit control" },
          { label: "Actionable Follow-Ups", icon: CalendarClock, path: "/followups", desc: "Unified timeline & contact agenda" },
          { label: "Customers Directory", icon: Building2, path: "/customers", desc: "Accounts, tiers, & mapping counts" },
          { label: "Products Catalog", icon: Boxes, path: "/products", desc: "Principals & SKU price master" },
          { label: "Users & Governance", icon: UsersRound, path: "/users", desc: "Team roles & accounts assignment" },
        ],
        customers: customers.slice(0, 5),
        products: products.slice(0, 4),
        leads: leads.slice(0, 3),
        orders: orders.slice(0, 2),
        payments: payments.slice(0, 2),
      };
    }

    return {
      pages: [
        { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", desc: "Executive metrics" },
        { label: "Projections", icon: Repeat, path: "/projections", desc: "Recurring worksheet" },
        { label: "New Sales Pipeline", icon: Target, path: "/leads", desc: "Leads & pipeline" },
        { label: "Sales Orders", icon: ShoppingCart, path: "/orders", desc: "Orders & fulfillment" },
        { label: "Payments Follow-Up", icon: Receipt, path: "/payments", desc: "Outstanding invoices" },
        { label: "Follow-Ups", icon: CalendarClock, path: "/followups", desc: "Contact agenda" },
        { label: "Customers", icon: Building2, path: "/customers", desc: "Directory" },
        { label: "Products", icon: Boxes, path: "/products", desc: "Catalog" },
      ].filter((p) => p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)),

      customers: customers
        .filter((c) => c.name.toLowerCase().includes(q) || (c.contactName || "").toLowerCase().includes(q))
        .slice(0, 8),

      products: products
        .filter((p) => p.name.toLowerCase().includes(q) || (p.principalName || "").toLowerCase().includes(q))
        .slice(0, 6),

      leads: leads
        .filter((l) => l.name.toLowerCase().includes(q) || (l.contactName || "").toLowerCase().includes(q))
        .slice(0, 4),

      orders: orders
        .filter((o) => (o.code || "").toLowerCase().includes(q) || (o.customerName || "").toLowerCase().includes(q))
        .slice(0, 4),

      payments: payments
        .filter((p) => (p.refNo || "").toLowerCase().includes(q) || (p.customerName || "").toLowerCase().includes(q))
        .slice(0, 4),
    };
  }, [query, customers, products, leads, orders, payments]);

  const handleGoPage = (path: string) => {
    navigate(path);
    onClose();
  };

  const handlePickCustomer = (cid: string) => {
    onClose();
    if (onSelectCustomer) {
      onSelectCustomer(cid);
    } else {
      navigate("/customers");
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
                          {c.tier} · {c.contactName || "Direct"} · {c.phone || c.mobile || "—"}
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
                    onClick={() => handleGoPage("/products")}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-2 text-left cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-surface border border-line text-muted shadow-2xs">
                        <Boxes className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-ink">{pr.name}</div>
                        <div className="text-[11px] text-muted">
                          {pr.principalName} · List Price: ₹{pr.listPrice}/{pr.unit}
                        </div>
                      </div>
                    </div>
                    <span className="font-bold text-ink tabular-nums text-xs">₹{pr.listPrice}</span>
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
                    onClick={() => handleGoPage("/orders")}
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
                      {inr(o.lines.reduce((s, l) => s + l.qty * l.price, 0))}
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
                    onClick={() => handleGoPage("/payments")}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-surface-2 text-left cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-surface border border-line text-muted shadow-2xs">
                        <Receipt className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-ink">{p.refNo}</div>
                        <div className="text-[11px] text-muted">{p.customerName} · {p.zone}</div>
                      </div>
                    </div>
                    <span className="font-bold text-red tabular-nums text-xs">
                      Pending {inr(p.pending)}
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
