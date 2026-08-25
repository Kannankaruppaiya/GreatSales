import { useEffect, useMemo, useState } from "react";
import {
  Building,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useAuthRole } from "@/store/auth";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { AddProductModal } from "@/features/products/AddProductModal";
import { AddPrincipalModal } from "@/features/products/AddPrincipalModal";
import { EditProductModal } from "@/features/products/EditProductModal";
import {
  useProducts,
  usePrincipals,
  useUpdateProduct,
  flattenProducts,
} from "@/features/products/queries";
import type { ProductRow } from "@/features/products/types";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function ProductsPage() {
  const role = useAuthRole();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [principalId, setPrincipalId] = useState("ALL");
  const [division, setDivision] = useState("ALL");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddPrincipal, setShowAddPrincipal] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);

  const canEdit = role !== "mgmt";

  const principalsQuery = usePrincipals();
  const principals = principalsQuery.data?.items ?? [];

  const params = {
    search: debouncedSearch.trim() || undefined,
    principalId: principalId === "ALL" ? undefined : principalId,
  };
  const q = useProducts(params);
  const update = useUpdateProduct();

  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");

  const products = flattenProducts(q.data);

  // Division filter options are derived from the rows already loaded — there is
  // no dedicated endpoint and `ProductListQuerySchema` has no `division` param,
  // same pattern as CustomersPage's category filter. NOTE: because the list is
  // cursor-paginated, this narrows only the pages fetched so far; push it into
  // the API query when the catalog outgrows a few pages.
  const divisionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.division) set.add(p.division);
    return [...set].sort();
  }, [products]);

  const visibleProducts = useMemo(
    () => (division === "ALL" ? products : products.filter((p) => p.division === division)),
    [products, division],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Product & Principal Master Catalog"
        subtitle="Catalog of industrial lubricants, sealants, fluids, and OEM principal brand distributions"
      />

      {/* 1. Principal Master Card */}
      <Card className="p-0 overflow-hidden shadow-xs border-line bg-surface">
        <div className="p-3.5 border-b border-line flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-brand/10 text-brand flex items-center justify-center">
              <Building className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-sm text-ink">Principal Master Brands</span>
            <span className="text-xs text-muted font-semibold rounded-full bg-surface-2 px-2 py-0.5 border border-line/60">
              {principals.length} brands
            </span>
          </div>

          {canEdit && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setShowAddPrincipal(true)}
              className="text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1 text-brand" /> Add Brand
            </Button>
          )}
        </div>

        <div className="p-3.5 flex items-center gap-2 flex-wrap">
          {principalsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
              <span>Loading brands…</span>
            </div>
          ) : principals.length === 0 ? (
            <div className="text-xs text-muted flex items-center justify-between w-full py-1">
              <span>No principal brands registered yet. Create your first brand to organize products.</span>
              {canEdit && (
                <Button size="xs" onClick={() => setShowAddPrincipal(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Create Brand
                </Button>
              )}
            </div>
          ) : (
            principals.map((pr) => {
              const isSelected = principalId === pr.id;
              return (
                <button
                  key={pr.id}
                  type="button"
                  onClick={() => setPrincipalId(isSelected ? "ALL" : pr.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer",
                    isSelected
                      ? "border-brand bg-brand text-white shadow-xs"
                      : "border-line bg-surface hover:bg-surface-2 text-ink hover:border-brand/40",
                  )}
                >
                  <span>{pr.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                      isSelected ? "bg-white/20 text-white" : "bg-surface-2 text-muted",
                    )}
                  >
                    {pr.productCount ?? 0}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </Card>

      {/* 2. Sub Products List Card */}
      <Card className="p-0 overflow-hidden shadow-xs border-line bg-surface">
        <div className="p-3 border-b border-line flex items-center justify-between gap-2.5 flex-wrap bg-surface">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search catalog by name or SKU…"
              className="w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-brand focus:border-brand"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted" />
              <select
                value={principalId}
                onChange={(e) => setPrincipalId(e.target.value)}
                aria-label="Filter products by principal brand"
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-brand focus:border-brand"
              >
                <option value="ALL">All Brands ({principals.length})</option>
                {principals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                aria-label="Filter products by division"
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-brand focus:border-brand"
              >
                <option value="ALL">All Product Divisions</option>
                {divisionOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-muted font-semibold px-1">
              {visibleProducts.length} {visibleProducts.length === 1 ? "product" : "products"}
            </span>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                q.refetch();
                principalsQuery.refetch();
              }}
              className="ml-auto"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5 mr-1",
                  (q.isFetching || principalsQuery.isFetching) && "animate-spin text-brand",
                )}
              />
              Refresh
            </Button>

            {canEdit && (
              <Button size="sm" onClick={() => setShowAddProduct(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Product
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[66vh]">
          <QueryBoundary
            isLoading={q.isLoading}
            isError={q.isError}
            error={q.error}
            isEmpty={visibleProducts.length === 0}
            emptyLabel="No catalog products match your filter criteria."
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3 w-[120px]">SKU Code</th>
                  <th className="py-2.5 px-3 min-w-[220px]">Product Name</th>
                  <th className="py-2.5 px-3">Principal Brand</th>
                  <th className="py-2.5 px-3">Division</th>
                  <th className="py-2.5 px-3 text-center">Unit (UOM)</th>
                  <th className="py-2.5 px-3 text-right">List Price ₹</th>
                  {canEdit && <th className="py-2.5 px-3 text-center w-[70px]">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {visibleProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-2 px-3 whitespace-nowrap">
                      {p.sku ? (
                        <span className="inline-block rounded border border-brand/25 bg-brand-soft px-2 py-0.5 font-mono text-[11px] font-bold text-brand-ink">
                          {p.sku}
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-muted">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-bold text-ink">
                      <span className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-brand/60 shrink-0" />
                        <span>{p.name}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <Badge variant="brand">{p.principalName}</Badge>
                    </td>
                    <td className="py-2 px-3 text-muted text-xs font-medium">
                      {p.division || "General"}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <span className="inline-block rounded border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold text-ink">
                        {p.unit || "Ltr"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      {canEdit ? (
                        <span className="inline-flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="0.01"
                            aria-label={`List price for ${p.name}`}
                            value={
                              editingPriceId === p.id
                                ? priceDraft
                                : p.basePrice != null
                                  ? String(p.basePrice)
                                  : ""
                            }
                            placeholder="Custom"
                            onFocus={() => {
                              setEditingPriceId(p.id);
                              setPriceDraft(p.basePrice != null ? String(p.basePrice) : "");
                            }}
                            onChange={(e) => setPriceDraft(e.target.value)}
                            onBlur={(e) => {
                              const val = e.target.value === "" ? null : Number(e.target.value);
                              if (val !== p.basePrice) {
                                update.mutate({ id: p.id, patch: { basePrice: val } });
                              }
                              setEditingPriceId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                            className="w-24 rounded border border-line bg-surface px-2 py-1 text-right text-xs font-bold tabular-nums focus:outline-brand focus:border-brand"
                          />
                          <span className="text-[10px] font-medium text-muted w-8 text-left">
                            / {p.unit || "Ltr"}
                          </span>
                        </span>
                      ) : p.basePrice != null ? (
                        <span className="tabular-nums font-bold text-ink">
                          {inr(p.basePrice)}{" "}
                          <span className="text-[10px] font-medium text-muted">
                            / {p.unit || "Ltr"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted">Custom</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setEditProduct(p)}
                          title={`Edit ${p.name}`}
                          aria-label={`Edit ${p.name}`}
                          className="h-7 w-7 rounded-md border border-line bg-surface inline-flex items-center justify-center text-muted hover:text-brand hover:border-brand/40 hover:bg-brand-soft transition-colors shadow-2xs cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
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
              Load More Products
            </Button>
          </div>
        )}

        {update.isError && (
          <div className="px-3.5 pb-3 text-[11px] font-medium text-red">
            {update.error instanceof ApiError ? update.error.message : "Failed to save price."}
          </div>
        )}
      </Card>

      {/* Modals */}
      <AddProductModal
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        principals={principals}
        onOpenAddPrincipal={() => setShowAddPrincipal(true)}
      />

      <AddPrincipalModal
        open={showAddPrincipal}
        onClose={() => setShowAddPrincipal(false)}
      />

      <EditProductModal
        open={!!editProduct}
        onClose={() => setEditProduct(null)}
        product={editProduct}
        principals={principals}
      />
    </div>
  );
}
