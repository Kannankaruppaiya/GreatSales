import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useTrackerStore } from "@/store/trackerStore";
import { useUi } from "@/store/ui";
import { useAuthRole } from "@/store/auth";
import { useMockOwnerId } from "@/lib/mockOwner";
import { Button, Card } from "@/components/ui";
import { TierBadge } from "@/components/StatusBadge";
import { AddCustomerModal } from "@/components/modals/AddCustomerModal";
import { EditCustomerModal } from "@/components/modals/EditCustomerModal";
import { CustomerDrawer } from "@/components/CustomerDrawer";
import { toast } from "@/store/toastStore";
import type { Customer } from "@/data/types";

export default function CustomersPage() {
  const { ownerFilter } = useUi();
  const role = useAuthRole();
  const ownerId = useMockOwnerId();
  const { customers, projections, users, deleteCustomer } = useTrackerStore();

  const [search, setSearch] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [selectedDrawerCustId, setSelectedDrawerCustId] = useState<string | null>(null);

  const canEdit = role !== "mgmt";
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Product map count per customer
  const mapCount = useMemo(() => {
    const counts: Record<string, number> = {};
    projections.forEach((p) => {
      counts[p.customerId] = (counts[p.customerId] || 0) + 1;
    });
    return counts;
  }, [projections]);

  // Filter scoped customers
  const scopedCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rankMap: Record<string, number> = { Platinum: 0, Gold: 1, Silver: 2, Brass: 3, "": 4 };

    return customers
      .filter((c) => {
        if (role === "sales" && c.ownerId !== ownerId) return false;
        if (ownerFilter !== "ALL" && c.ownerId !== ownerFilter) return false;
        if (q && !c.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const rDiff = (rankMap[a.tier] ?? 4) - (rankMap[b.tier] ?? 4);
        if (rDiff !== 0) return rDiff;
        return a.name.localeCompare(b.name);
      });
  }, [customers, role, ownerId, ownerFilter, search]);

  const handleDelete = (c: Customer) => {
    if (role !== "admin") {
      alert("Only an administrator can delete a customer");
      return;
    }
    const count = mapCount[c.id] || 0;
    if (confirm(`Delete "${c.name}" and its ${count} product mapping(s)? This cannot be undone.`)) {
      deleteCustomer(c.id);
      toast.info("Customer account removed");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        {/* Toolbar */}
        <div className="p-3 border-b border-line flex items-center justify-between gap-2.5 flex-wrap bg-surface">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
            className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-brand focus:border-brand w-64 shadow-2xs"
          />

          <span className="text-xs text-muted font-medium">{scopedCustomers.length} accounts</span>

          {canEdit && (
            <div className="ml-auto">
              <Button size="sm" onClick={() => setShowAddCustomer(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> + Add New Customer
              </Button>
            </div>
          )}
        </div>

        {/* Customers Table */}
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
              <tr>
                <th className="py-2.5 px-3 min-w-[220px]">Customer</th>
                <th className="py-2.5 px-3">Contact</th>
                <th className="py-2.5 px-3">Mobile / WhatsApp</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Payment terms</th>
                <th className="py-2.5 px-3">Salesperson</th>
                <th className="py-2.5 px-3 text-right">SKUs Mapped</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {scopedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-xs text-muted">
                    No customer accounts found matching search.
                  </td>
                </tr>
              ) : (
                scopedCustomers.map((c) => {
                  const sp = userMap.get(c.ownerId)?.name || "—";
                  const pMapped = mapCount[c.id] || 0;
                  return (
                    <tr key={c.id} className="hover:bg-surface-2/70 transition-colors">
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => setSelectedDrawerCustId(c.id)}
                          className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left block"
                        >
                          {c.name}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-muted">{c.contactName || "—"}</td>
                      <td className="py-2.5 px-3 text-muted text-xs tabular-nums">
                        {c.phone || c.mobile || "—"}
                        {c.whatsapp && c.whatsapp !== c.phone ? ` / ${c.whatsapp}` : ""}
                      </td>
                      <td className="py-2.5 px-3">
                        <TierBadge tier={c.tier || "Silver"} />
                      </td>
                      <td className="py-2.5 px-3 text-muted text-xs font-medium">{c.paymentTerms || "30 Days Credit"}</td>
                      <td className="py-2.5 px-3 text-muted text-xs">{sp}</td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-ink">{pMapped}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedDrawerCustId(c.id)}
                            className="text-brand hover:underline font-bold text-xs cursor-pointer"
                          >
                            360 View
                          </button>
                          {role === "admin" && (
                            <>
                              <span className="text-muted">·</span>
                              <button
                                type="button"
                                onClick={() => setEditCustomer(c)}
                                className="text-muted hover:text-ink hover:underline font-medium text-xs cursor-pointer"
                              >
                                Edit
                              </button>
                              <span className="text-muted">·</span>
                              <button
                                type="button"
                                onClick={() => handleDelete(c)}
                                className="text-red hover:underline font-bold text-xs cursor-pointer"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Customer 360 Drawer */}
      <CustomerDrawer
        customerId={selectedDrawerCustId}
        onClose={() => setSelectedDrawerCustId(null)}
      />

      {/* Modals */}
      <AddCustomerModal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />

      {editCustomer && (
        <EditCustomerModal
          open={!!editCustomer}
          onClose={() => setEditCustomer(null)}
          customer={editCustomer}
        />
      )}
    </div>
  );
}
