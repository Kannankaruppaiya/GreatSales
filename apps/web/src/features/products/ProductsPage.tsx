import { useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { useAuthRole } from "@/store/auth";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { AddProductModal } from "@/features/products/AddProductModal";
import { useProducts, useUpdateProduct, flattenProducts } from "@/features/products/queries";

export default function ProductsPage() {
  const role = useAuthRole();

  const [search, setSearch] = useState("");
  const [principalId, setPrincipalId] = useState("ALL");
  const [showAddProduct, setShowAddProduct] = useState(false);

  const canEdit = role !== "mgmt"; // mgmt is read-only; sales role is mobile-only

  const params = {
    search: search.trim() || undefined,
    principalId: principalId === "ALL" ? undefined : principalId,
  };
  const q = useProducts(params);
  const update = useUpdateProduct();

  const products = flattenProducts(q.data);

  // Principal filter options + per-principal product counts — there is no
  // dedicated principals endpoint, so both are derived from the loaded rows.
  const { principalOptions, principalCounts } = useMemo(() => {
    const options = new Map<string, string>();
    const counts = new Map<string, number>();
    for (const p of products) {
      options.set(p.principalId, p.principalName);
      counts.set(p.principalName, (counts.get(p.principalName) || 0) + 1);
    }
    return {
      principalOptions: [...options.entries()].map(([id, name]) => ({ id, name })),
      principalCounts: counts,
    };
  }, [products]);

  return (
    <div className="space-y-4">
      {/* 1. Principal Master Card */}
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3.5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-ink">Principal master</span>
            <span className="text-xs text-muted font-medium">
              {principalOptions.length} principals
            </span>
            <span className="rounded-full border border-brand/30 bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-ink">
              LIVE API
            </span>
          </div>
        </div>

        <div className="p-3.5 flex items-center gap-2 flex-wrap">
          {principalOptions.length === 0 ? (
            <span className="text-xs text-muted">No principals yet — add a product to introduce one.</span>
          ) : (
            principalOptions.map((pr) => (
              <span
                key={pr.id}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink flex items-center gap-1.5 shadow-2xs"
              >
                <span>{pr.name}</span>
                <span className="rounded-full bg-surface-2 px-1.5 py-0.2 text-[10px] text-muted">
                  {principalCounts.get(pr.name) || 0}
                </span>
              </span>
            ))
          )}
        </div>
      </Card>

      {/* 2. Sub Products List Card */}
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3 border-b border-line flex items-center justify-between gap-2.5 flex-wrap bg-surface">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sub products or SKU…"
            className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-brand focus:border-brand w-64"
          />

          {principalOptions.length > 0 && (
            <select
              value={principalId}
              onChange={(e) => setPrincipalId(e.target.value)}
              className="h-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-brand focus:border-brand"
            >
              <option value="ALL">All principals</option>
              {principalOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <span className="text-xs text-muted font-medium">{products.length} sub products</span>

          <Button
            size="sm"
            variant="outline"
            onClick={() => q.refetch()}
            className="ml-auto"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", q.isFetching && "animate-spin")} />
            Refresh
          </Button>

          {canEdit && (
            <Button size="sm" onClick={() => setShowAddProduct(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> + Add new product
            </Button>
          )}
        </div>

        <div className="overflow-x-auto max-h-[66vh]">
          <QueryBoundary
            isLoading={q.isLoading}
            isError={q.isError}
            error={q.error}
            isEmpty={products.length === 0}
            emptyLabel="No products match your search."
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3">Principal</th>
                  <th className="py-2.5 px-3">Sub product</th>
                  <th className="py-2.5 px-3 text-right">Default selling price ₹</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-2 px-3 text-muted text-xs font-semibold">{p.principalName}</td>
                    <td className="py-2 px-3 font-bold text-ink">{p.name}</td>
                    <td className="py-2 px-3 text-right">
                      {canEdit ? (
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={p.basePrice != null ? p.basePrice : ""}
                          placeholder="—"
                          onBlur={(e) => {
                            const val = e.target.value === "" ? null : Number(e.target.value);
                            if (val !== p.basePrice) {
                              update.mutate({ id: p.id, patch: { basePrice: val } });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="w-24 rounded border border-line bg-surface px-2 py-1 text-right text-xs font-bold tabular-nums focus:outline-brand focus:border-brand"
                        />
                      ) : (
                        <span className="tabular-nums font-bold text-ink">
                          {p.basePrice != null ? inr(p.basePrice) : "—"}
                        </span>
                      )}
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
        principals={principalOptions}
      />
    </div>
  );
}
