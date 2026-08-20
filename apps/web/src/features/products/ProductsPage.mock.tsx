import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useTrackerStore } from "@/store/trackerStore";
import { useUi } from "@/store/ui";
import { useAuthRole } from "@/store/auth";
import { inr } from "@/lib/format";
import { Button, Card } from "@/components/ui";
import { AddPrincipalModal } from "@/features/products/AddPrincipalModal";
import { AddProductModal } from "@/features/products/AddProductModal";

export default function ProductsPage() {
  const { principalId } = useUi();
  const role = useAuthRole();
  const { principals, products, projections, updateProductPrice } = useTrackerStore();

  const [search, setSearch] = useState("");
  const [showAddPrincipal, setShowAddPrincipal] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  const canEdit = role !== "mgmt"; // mgmt is read-only; sales role is mobile-only

  // Product mapping counts
  const mapCount = useMemo(() => {
    const counts: Record<string, number> = {};
    projections.forEach((p) => {
      counts[p.productId] = (counts[p.productId] || 0) + 1;
    });
    return counts;
  }, [projections]);

  // Principal product counts
  const principalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      const brand = p.principalName || "OTHER";
      counts[brand] = (counts[brand] || 0) + 1;
    });
    return counts;
  }, [products]);

  // Filtered sub-products list
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (principalId !== "ALL" && p.principalId !== principalId) return false;
        if (q && !(p.name.toLowerCase().includes(q) || (p.principalName || "").toLowerCase().includes(q))) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.principalName === b.principalName) {
          return a.name.localeCompare(b.name);
        }
        return (a.principalName || "").localeCompare(b.principalName || "");
      });
  }, [products, principalId, search]);

  return (
    <div className="space-y-4">
      {/* 1. Principal Master Card */}
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3.5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-ink">Principal master</span>
            <span className="text-xs text-muted font-medium">{principals.length} principals</span>
          </div>

          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowAddPrincipal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> + Add principal
            </Button>
          )}
        </div>

        <div className="p-3.5 flex items-center gap-2 flex-wrap">
          {principals.map((pr) => (
            <span
              key={pr.id}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink flex items-center gap-1.5 shadow-2xs"
            >
              <span>{pr.name}</span>
              <span className="rounded-full bg-surface-2 px-1.5 py-0.2 text-[10px] text-muted">
                {principalCounts[pr.name] || 0}
              </span>
            </span>
          ))}
        </div>
      </Card>

      {/* 2. Sub Products List Card */}
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3 border-b border-line flex items-center justify-between gap-2.5 flex-wrap bg-surface">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sub products or principals…"
            className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-brand focus:border-brand w-64"
          />

          <span className="text-xs text-muted font-medium">{filteredProducts.length} sub products</span>

          {canEdit && (
            <div className="ml-auto">
              <Button size="sm" onClick={() => setShowAddProduct(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> + Add new product
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto max-h-[66vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
              <tr>
                <th className="py-2.5 px-3">Principal</th>
                <th className="py-2.5 px-3">Sub product</th>
                <th className="py-2.5 px-3 text-right">Default selling price ₹</th>
                <th className="py-2.5 px-3 text-right">Customers mapped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-xs text-muted">
                    No products match your search.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const mCount = mapCount[p.id] || 0;
                  return (
                    <tr key={p.id} className="hover:bg-surface-2/60 transition-colors">
                      <td className="py-2 px-3 text-muted text-xs font-semibold">{p.principalName}</td>
                      <td className="py-2 px-3 font-bold text-ink">{p.name}</td>
                      <td className="py-2 px-3 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            step="0.01"
                            value={p.listPrice != null ? p.listPrice : ""}
                            placeholder="—"
                            onChange={(e) => {
                              const val = e.target.value === "" ? 0 : Number(e.target.value);
                              updateProductPrice(p.id, val);
                            }}
                            className="w-24 rounded border border-line bg-surface px-2 py-1 text-right text-xs font-bold tabular-nums focus:outline-brand focus:border-brand"
                          />
                        ) : (
                          <span className="tabular-nums font-bold text-ink">
                            {p.listPrice != null ? inr(p.listPrice) : "—"}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-bold tabular-nums text-ink">{mCount}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
      <AddPrincipalModal open={showAddPrincipal} onClose={() => setShowAddPrincipal(false)} />
      <AddProductModal open={showAddProduct} onClose={() => setShowAddProduct(false)} />
    </div>
  );
}
