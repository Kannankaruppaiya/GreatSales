import { useEffect, useState } from "react";
import { Link2, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useAuthRole } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { toast } from "@/store/toastStore";
import { MappingFormModal } from "@/features/mappings/MappingFormModal";
import {
  useMappings,
  useDeleteMapping,
  flattenMappings,
} from "@/features/mappings/queries";
import type { MappingRow } from "@/features/mappings/types";
import { useCustomers, flattenCustomers } from "@/features/customers/queries";
import { useProducts, flattenProducts } from "@/features/products/queries";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Customer x product mappings — which products a customer buys, at what agreed
 * price, and who owns the relationship.
 *
 * This is the input to the projections worksheet: every projection line
 * resolves its customer, product, principal, salesperson and price through a
 * mapping. Before this page existed there was no way to create one, so the
 * worksheet could only ever show rows that arrived with the seed.
 */
export default function MappingsPage() {
  const role = useAuthRole();
  // Mirrors the API: POST/PATCH/DELETE /mappings requires `projection.write`,
  // which `mgmt` does not hold (packages/shared/src/rbac.ts) though the route
  // itself is open to every role for reading. Without this gate a management
  // user saw fully live-looking Map/Edit/Delete controls that only failed
  // once the request reached the server.
  const canEdit = role !== "mgmt";
  const globalOwnerFilter = useUi((s) => s.ownerFilter);
  const globalPrincipal = useUi((s) => s.principalId);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [unpricedOnly, setUnpricedOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MappingRow | null>(null);

  const q = useMappings({
    search: debouncedSearch || undefined,
    ownerId: globalOwnerFilter === "ALL" ? undefined : globalOwnerFilter,
    principalId: globalPrincipal === "ALL" ? undefined : globalPrincipal,
    unpriced: unpricedOnly || undefined,
  });
  const mappings = flattenMappings(q.data);
  // The server's count, not the number of rows fetched so far. The badge used
  // to read `mappings.length + "+"`, so a book of 883 mappings announced
  // itself as "50+" — the one number on the page a person would quote.
  const total = q.data?.pages[0]?.total ?? mappings.length;

  /**
   * How many mappings cannot price anything.
   *
   * A mapping with neither an agreed nor a catalog price behind it projects at
   * ZERO (projection-engine: `projectionPrice ?? customPrice ?? basePrice ?? 0`)
   * on a page whose own subtitle calls it "the basis for every projection
   * line". One count, one click to see them.
   */
  const unpricedQ = useMappings(
    {
      ownerId: globalOwnerFilter === "ALL" ? undefined : globalOwnerFilter,
      principalId: globalPrincipal === "ALL" ? undefined : globalPrincipal,
      unpriced: true,
    },
    { enabled: !unpricedOnly },
  );
  const unpricedCount = unpricedOnly
    ? total
    : (unpricedQ.data?.pages[0]?.total ?? 0);

  // The form needs pickers, and nothing else on this page does — so they are
  // fetched when it opens rather than on every visit to the list.
  const customersQ = useCustomers({}, { enabled: showForm });
  const productsQ = useProducts({}, { enabled: showForm });
  const customers = flattenCustomers(customersQ.data);
  const products = flattenProducts(productsQ.data);

  // Both lists are cursor-paginated at 50, and a picker that stops at 50 cannot
  // reach the other 367 customers — the user would simply be unable to map most
  // of their book. So pull the remaining pages once the form is open.
  //
  // This is a stopgap, not the end state: it is O(rows) requests and will not
  // hold at 10k customers. The real fix is a server-searched typeahead, which
  // needs a search endpoint this slice does not add
  // (checklists/03-API.md C.3.4).
  //
  // Keyed on the flags, not on the query OBJECTS: those are a new identity on
  // every render, so this effect used to re-run on each one for as long as the
  // form stayed open.
  const { hasNextPage: moreCustomers, isFetchingNextPage: fetchingCustomers } = customersQ;
  const { hasNextPage: moreProducts, isFetchingNextPage: fetchingProducts } = productsQ;
  const fetchMoreCustomers = customersQ.fetchNextPage;
  const fetchMoreProducts = productsQ.fetchNextPage;
  useEffect(() => {
    if (!showForm) return;
    if (moreCustomers && !fetchingCustomers) void fetchMoreCustomers();
    if (moreProducts && !fetchingProducts) void fetchMoreProducts();
  }, [
    showForm,
    moreCustomers,
    fetchingCustomers,
    moreProducts,
    fetchingProducts,
    fetchMoreCustomers,
    fetchMoreProducts,
  ]);

  const del = useDeleteMapping();

  const handleDelete = async (row: MappingRow) => {
    if (del.isPending) return;
    try {
      await del.mutateAsync(row.id);
      toast.success(`Unmapped ${row.productName} from ${row.customerName}.`);
    } catch (err) {
      // MAPPING_IN_USE is the one that matters: the server refuses while
      // projection lines still resolve through this mapping, and its message
      // says how many. Surfacing it verbatim beats a generic failure.
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Could not remove the mapping. Please try again.",
      );
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer & Product Mapping"
        subtitle="Which products each customer buys, at what agreed price — the basis for every projection line"
      />

      <Card className="p-0 overflow-hidden shadow-xs border-line bg-surface">
        <div className="p-3.5 border-b border-line flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-brand/10 text-brand flex items-center justify-center">
              <Link2 className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-sm text-ink">Mappings</span>
            <span className="text-xs text-muted font-semibold rounded-full bg-surface-2 px-2 py-0.5 border border-line/60">
              {total.toLocaleString("en-IN")}
            </span>
            {unpricedCount > 0 && (
              <button
                type="button"
                onClick={() => setUnpricedOnly((v) => !v)}
                aria-pressed={unpricedOnly}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors cursor-pointer",
                  unpricedOnly
                    ? "border-red bg-red text-white"
                    : "border-red/40 bg-red-soft text-red hover:border-red",
                )}
              >
                {unpricedCount.toLocaleString("en-IN")} need a price
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, product or SKU"
                aria-label="Search mappings"
                className="h-8 w-64 rounded-md border border-line bg-surface pl-7 pr-2 text-xs text-ink placeholder:text-muted"
              />
            </div>
            {canEdit && (
              <Button
                size="xs"
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Map a product
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[66vh]">
          <QueryBoundary
            isLoading={q.isLoading}
            isError={q.isError}
            error={q.error}
            isEmpty={mappings.length === 0}
            emptyLabel={
              debouncedSearch
                ? "No mappings match your search."
                : unpricedOnly
                  ? "Every mapping in view has a price behind it."
                  : "No mappings yet. Map a product to a customer to start projecting it."
            }
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 text-2xs font-bold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs whitespace-nowrap">
                <tr>
                  <th className="py-2.5 px-3 min-w-[200px]">Customer</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Product</th>
                  <th className="py-2.5 px-3">Principal</th>
                  <th className="py-2.5 px-3 text-right">Catalog</th>
                  <th className="py-2.5 px-3 text-right">Agreed</th>
                  <th className="py-2.5 px-3 text-right">Effective</th>
                  <th className="py-2.5 px-3">Salesperson</th>
                  {canEdit && <th className="py-2.5 px-3 w-[90px]">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} className="border-b border-line/60 hover:bg-surface-2/50">
                    <td className="py-2 px-3 font-semibold text-ink">
                      <span className="block max-w-[240px] truncate" title={m.customerName}>
                        {m.customerName}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="text-ink">{m.productName}</div>
                      {m.productSku && (
                        <div className="text-[11px] text-muted">{m.productSku}</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-muted">{m.principalName}</td>
                    <td className="py-2 px-3 text-right text-muted tabular-nums">
                      {m.basePrice == null ? "—" : inr(m.basePrice)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {m.customPrice == null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <Badge variant="brand">{inr(m.customPrice)}</Badge>
                      )}
                    </td>
                    {/* Straight from the server. Recomputing it here is how two
                        surfaces end up disagreeing about what a customer pays. */}
                    {/* A mapping with no price behind it projects at zero, so
                        it is marked rather than left as another dash among
                        three. */}
                    <td className="py-2 px-3 text-right font-semibold text-ink tabular-nums">
                      {m.effectivePrice == null ? (
                        <span className="rounded bg-red-soft px-1.5 py-0.5 text-3xs font-bold text-red">
                          No price
                        </span>
                      ) : (
                        inr(m.effectivePrice)
                      )}
                    </td>
                    <td className="py-2 px-3 text-muted">{m.salespersonName}</td>
                    {canEdit && (
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="iconSm"
                            variant="ghost"
                            aria-label={`Edit mapping for ${m.productName}`}
                            onClick={() => {
                              setEditing(m);
                              setShowForm(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="iconSm"
                            variant="ghost"
                            aria-label={`Remove mapping for ${m.productName}`}
                            disabled={del.isPending}
                            onClick={() => void handleDelete(m)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {q.hasNextPage && (
              <div className="flex justify-center p-3">
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={q.isFetchingNextPage}
                  onClick={() => void q.fetchNextPage()}
                >
                  {q.isFetchingNextPage && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Load more
                </Button>
              </div>
            )}
          </QueryBoundary>
        </div>
      </Card>

      <MappingFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        editing={editing}
        customers={customers}
        products={products}
      />
    </div>
  );
}
