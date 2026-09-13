import { useEffect, useMemo } from "react";
import { Plus, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useProducts, flattenProducts, usePrincipals } from "@/features/products/queries";

/**
 * One row of the "products this account buys" repeater: a principal, one of its
 * sub products, and the agreed price if it differs from the catalog.
 *
 * `principalId` is held alongside `productId` even though the product already
 * knows its principal — it is the filter for the second select, and keeping it
 * in the row is what lets a half-made row (principal chosen, product not yet)
 * exist without being submittable.
 */
export interface MappingDraft {
  principalId: string;
  productId: string;
  /** Free text so the field can be empty, meaning "use the catalog price". */
  price: string;
}

export function emptyDraft(principalId = ""): MappingDraft {
  return { principalId, productId: "", price: "" };
}

/** The rows worth sending: a product was actually picked. */
export function draftsToSeeds(rows: MappingDraft[]) {
  return rows
    .filter((r) => r.productId)
    .map((r) => ({
      productId: r.productId,
      customPrice: r.price.trim() ? Number(r.price) : null,
    }));
}

/** First duplicate product in the draft rows, or null. Names the row, not just the fact. */
export function duplicateProductIndex(rows: MappingDraft[]): number | null {
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i].productId;
    if (!id) continue;
    if (seen.has(id)) return i;
    seen.add(id);
  }
  return null;
}

/**
 * Principal x sub-product rows for the add-customer form.
 *
 * A recurring-sales account is not usable until something is mapped to it, so
 * this sits in the same form rather than behind a second trip to the mappings
 * page — which is how the POC's "Add new customer" worked, and the reason a
 * customer created in the console could not be projected against.
 */
export function CustomerProductMappings({
  rows,
  onChange,
  disabled,
  enabled = true,
  error,
}: {
  rows: MappingDraft[];
  onChange: (rows: MappingDraft[]) => void;
  disabled?: boolean;
  /** Only fetch the catalog while the form is open. */
  enabled?: boolean;
  error?: string;
}) {
  const principalsQuery = usePrincipals({ enabled });
  // `GET /principals` answers `{ items }`, not a bare array — see
  // PrincipalListResponse. Reading it as an array silently yields an empty
  // picker with no error anywhere.
  const principals = principalsQuery.data?.items ?? [];

  // The whole catalog, once, rather than a query per row: a row's product
  // select is a client-side filter over it, so changing a principal does not
  // cost a round trip.
  const productsQuery = useProducts({}, { enabled });
  // `.filter(Boolean)`: `flattenProducts` flat-maps `page.items`, so a page
  // that arrives without that key contributes `undefined` and the grouping
  // below dereferences it. Cheap insurance for a picker that lives inside
  // someone else's form.
  const products = useMemo(
    () => flattenProducts(productsQuery.data).filter(Boolean),
    [productsQuery.data],
  );

  // Products arrive a page at a time and every row filters the same list, so
  // pull the rest in rather than offering a principal whose products are on
  // page two.
  useEffect(() => {
    if (productsQuery.hasNextPage && !productsQuery.isFetchingNextPage) {
      void productsQuery.fetchNextPage();
    }
  }, [productsQuery.hasNextPage, productsQuery.isFetchingNextPage, productsQuery.fetchNextPage]);

  const byPrincipal = useMemo(() => {
    const m = new Map<string, typeof products>();
    for (const p of products) {
      const list = m.get(p.principalId);
      if (list) list.push(p);
      else m.set(p.principalId, [p]);
    }
    return m;
  }, [products]);

  const dupIndex = duplicateProductIndex(rows);
  const loading = productsQuery.isLoading || principalsQuery.isLoading;
  const seeds = draftsToSeeds(rows);
  const priced = seeds.filter((s) => s.customPrice != null);

  const setRow = (i: number, patch: Partial<MappingDraft>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-ink">Principal &amp; sub products</div>
          <div className="text-2xs text-muted">
            What this account buys. Leave the price empty to use the catalog price.
          </div>
        </div>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...rows, emptyDraft(principals[0]?.id ?? "")])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add product
        </Button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="py-3 text-2xs text-muted">Loading the catalogue…</div>
      ) : rows.length === 0 ? (
        <div className="py-3 text-2xs text-muted">
          No products yet. An account with nothing mapped cannot appear on the projections
          worksheet — add at least one.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const list = byPrincipal.get(row.principalId) ?? [];
            const picked = products.find((p) => p.id === row.productId);
            const isDup = dupIndex === i;
            return (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_auto_auto]">
                <Select
                  aria-label={`Principal for product row ${i + 1}`}
                  className="w-full"
                  selectClassName="w-full h-9"
                  value={row.principalId}
                  disabled={disabled}
                  onChange={(e) => setRow(i, { principalId: e.target.value, productId: "" })}
                >
                  <option value="">— Principal —</option>
                  {principals.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>

                <Select
                  aria-label={`Sub product for product row ${i + 1}`}
                  className="w-full"
                  selectClassName={cn("w-full h-9", isDup && "border-red")}
                  value={row.productId}
                  disabled={disabled || !row.principalId}
                  onChange={(e) => setRow(i, { productId: e.target.value })}
                >
                  <option value="">
                    {!row.principalId
                      ? "— Pick a principal first —"
                      : list.length === 0
                        ? "— No sub products —"
                        : "— Sub product —"}
                  </option>
                  {list.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.sku ? ` · ${p.sku}` : ""}
                    </option>
                  ))}
                </Select>

                <div className="relative flex items-center">
                  <span className="pointer-events-none absolute left-2.5 text-2xs font-semibold text-muted">
                    ₹
                  </span>
                  <Input
                    aria-label={`Agreed price for product row ${i + 1}`}
                    type="number"
                    step="0.01"
                    min="0"
                    // The catalog price as the placeholder, so an empty field
                    // reads as "this is what they will be charged" rather than
                    // as a missing value.
                    placeholder={
                      picked?.basePrice != null ? String(picked.basePrice) : "catalog"
                    }
                    value={row.price}
                    disabled={disabled}
                    onChange={(e) => setRow(i, { price: e.target.value })}
                    className="h-9 w-28 pl-6 text-xs tabular-nums"
                  />
                </div>

                <button
                  type="button"
                  aria-label={`Remove product row ${i + 1}`}
                  disabled={disabled}
                  onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted hover:border-red hover:text-red disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {dupIndex != null && (
        <p role="alert" className="mt-2 text-2xs font-medium text-red">
          The same sub product is mapped twice. Remove one of the rows.
        </p>
      )}
      {error && !dupIndex && (
        <p role="alert" className="mt-2 text-2xs font-medium text-red">
          {error}
        </p>
      )}

      {seeds.length > 0 && (
        <div className="mt-2 text-2xs text-muted">
          {seeds.length} product{seeds.length === 1 ? "" : "s"} will be mapped
          {priced.length > 0 &&
            // The typed figure verbatim, NOT `inr()` — that rounds, so an
            // agreed price of 137.5 echoed back as ₹138 reads as the form
            // having changed the number.
            ` · ${priced.length} at an agreed price (${priced
              .map((s) => `₹${s.customPrice as number}`)
              .join(", ")})`}
          .
        </div>
      )}
    </div>
  );
}
