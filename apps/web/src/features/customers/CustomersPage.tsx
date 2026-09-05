import { useEffect, useState } from "react";
import { Loader2, Phone, Plus, RefreshCw, User, UserCheck } from "lucide-react";
import { useAuthRole } from "@/store/auth";
import { useUi } from "@/store/ui";
import { cn } from "@/lib/utils";
import { Button, Card, PageHeader } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { AddCustomerModal } from "@/features/customers/AddCustomerModal";
import { EditCustomerModal } from "@/features/customers/EditCustomerModal";
import { CustomerDrawer } from "@/features/customers/CustomerDrawer";
import { ReassignCustomersModal } from "@/features/customers/ReassignCustomersModal";
import { useCustomers, flattenCustomers, useIndustries } from "@/features/customers/queries";
import { useUsers, flattenUsers } from "@/features/users/queries";
import { CUSTOMER_TIERS, INDUSTRIAL_AREAS } from "@/data/constants";
import type { CustomerRow } from "@/features/customers/types";

/**
 * Debounces a fast-changing value (e.g. search input) so downstream effects
 * (e.g. a query key) only settle `delayMs` after the user stops typing.
 * Mirrors the same local hook in ProductsPage.tsx / UsersPage.tsx — lift into
 * a shared hook once a further page needs it.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function CustomersPage() {
  const role = useAuthRole();
  const globalOwnerFilter = useUi((s) => s.ownerFilter);
  const globalPrincipal = useUi((s) => s.principalId);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [category, setCategory] = useState("ALL");
  const [ownerId, setOwnerId] = useState("ALL");
  const [area, setArea] = useState("ALL");
  const [industry, setIndustry] = useState("ALL");

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerRow | null>(null);
  // The full row, not just an id — the drawer is handed it directly so it
  // never has to re-resolve a filtered/paginated row via its own fallback
  // fetch (which only sees an unfiltered first page).
  const [selectedDrawerCustomer, setSelectedDrawerCustomer] = useState<CustomerRow | null>(null);
  const [showReassign, setShowReassign] = useState(false);

  const canEdit = role !== "mgmt";
  const effectiveOwner = ownerId !== "ALL" ? ownerId : globalOwnerFilter !== "ALL" ? globalOwnerFilter : undefined;

  // Every filter on this page is a server filter. They used to be split: the
  // API narrowed by search/category/owner while area and industry were applied
  // with Array.filter over the rows already loaded, so a page-2 match simply
  // did not exist as far as the user could tell.
  const params = {
    search: debouncedSearch.trim() || undefined,
    category: category === "ALL" ? undefined : category,
    ownerId: effectiveOwner,
    area: area === "ALL" ? undefined : area,
    industryId: industry === "ALL" ? undefined : industry,
    principalId: globalPrincipal === "ALL" ? undefined : globalPrincipal,
  };
  const q = useCustomers(params);
  const customers = flattenCustomers(q.data);

  // Filter options come from sources INDEPENDENT of the current filter.
  //
  // They used to be derived from the loaded rows, which worked only while the
  // filters were applied client-side. Now that area/industry/owner narrow the
  // QUERY, a row-derived list would collapse to the value you just picked —
  // choose "Ambattur" and Ambattur becomes the only area you can choose.
  //
  //   area      → INDUSTRIAL_AREAS, the same list Add/Edit Customer writes from
  //   industry  → GET /industries, the global catalogue
  //   owner     → GET /users, not "owners seen so far"
  //   category  → CUSTOMER_TIERS, a fixed enum
  const industriesQ = useIndustries();
  const industryOptions = industriesQ.data ?? [];
  const usersQ = useUsers();
  const salespersonOptions = flattenUsers(usersQ.data).filter((u) =>
    u.roleName?.toLowerCase().includes("sales"),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer Master Directory"
        subtitle="Directory of all industrial clients, verified accounts, key decision-maker contacts, and outstanding balances"
      />

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

          <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-brand focus:border-brand"
            >
              <option value="ALL">All categories</option>
              {CUSTOMER_TIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

          {salespersonOptions.length > 0 && (
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="h-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-brand focus:border-brand"
            >
              <option value="ALL">All salespersons</option>
              {salespersonOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              aria-label="Filter customers by industrial area"
              className="h-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-brand focus:border-brand"
            >
              <option value="ALL">All Industrial Areas</option>
              {INDUSTRIAL_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

          {industryOptions.length > 0 && (
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              aria-label="Filter customers by industry sector"
              className="h-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-brand focus:border-brand"
            >
              <option value="ALL">All Industry Sectors</option>
              {industryOptions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          )}

          <span className="text-xs text-muted font-medium">
            {q.data?.pages[0]?.total ?? customers.length} accounts
          </span>

          <Button size="sm" variant="outline" onClick={() => q.refetch()}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", q.isFetching && "animate-spin")} />
            Refresh
          </Button>

          {role === "admin" && (
            <Button size="sm" variant="outline" onClick={() => setShowReassign(true)}>
              <UserCheck className="h-3.5 w-3.5 mr-1" /> Reassign accounts
            </Button>
          )}

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
          <QueryBoundary
            isLoading={q.isLoading}
            isError={q.isError}
            error={q.error}
            isEmpty={customers.length === 0}
            emptyLabel="No customer accounts found matching search."
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 text-[10.5px] font-extrabold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3 min-w-[220px]">Customer</th>
                  <th className="py-2.5 px-3">Area / Location</th>
                  <th className="py-2.5 px-3">Industry Sector</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Key Contact</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Payment terms</th>
                  <th className="py-2.5 px-3">Salesperson</th>
                  <th className="py-2.5 px-3 text-right">Outstanding</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2/70 transition-colors">
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => setSelectedDrawerCustomer(c)}
                        className="font-bold text-ink hover:text-brand hover:underline cursor-pointer text-left block"
                      >
                        {c.name}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-xs font-medium text-ink">
                      {c.area || "Other"}
                    </td>
                    <td className="py-2.5 px-3 text-xs font-medium text-ink">
                      {c.industryName || "General"}
                    </td>
                    <td className="py-2.5 px-3 text-muted">
                      {c.primaryContactName ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-ink flex items-center gap-1">
                            <User className="h-3 w-3 text-muted shrink-0" />
                            {c.primaryContactName}
                          </span>
                          {c.primaryContactPhone && (
                            <span className="text-[11px] text-muted font-mono flex items-center gap-1">
                              <Phone className="h-2.5 w-2.5 text-muted shrink-0" />
                              {c.primaryContactPhone}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="rounded px-2 py-0.5 text-[10.5px] font-bold bg-surface-2 text-ink border border-line">
                        {c.category || "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted text-xs font-medium">
                      {c.paymentTerms || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-muted text-xs">{c.salespersonName}</td>
                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-ink">
                      {c.outstanding}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDrawerCustomer(c)}
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
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </QueryBoundary>
        </div>

        {q.hasNextPage && (
          <div className="p-3 border-t border-line flex justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={() => q.fetchNextPage()}
              disabled={q.isFetchingNextPage}
            >
              {q.isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Load more
            </Button>
          </div>
        )}
      </Card>

      {/* Customer 360 Drawer */}
      <CustomerDrawer
        customerId={selectedDrawerCustomer?.id ?? null}
        customer={selectedDrawerCustomer ?? undefined}
        onClose={() => setSelectedDrawerCustomer(null)}
      />

      {/* Modals */}
      <AddCustomerModal
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        salespeople={salespersonOptions}
      />

      {editCustomer && (
        <EditCustomerModal
          open={!!editCustomer}
          onClose={() => setEditCustomer(null)}
          customer={editCustomer}
          salespeople={salespersonOptions}
        />
      )}

      {showReassign && (
        <ReassignCustomersModal
          open={showReassign}
          onClose={() => setShowReassign(false)}
          customers={customers}
          salespeople={salespersonOptions}
        />
      )}
    </div>
  );
}
