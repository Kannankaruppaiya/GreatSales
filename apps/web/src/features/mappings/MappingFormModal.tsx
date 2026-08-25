import { useState, useEffect } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { useCreateMapping, useUpdateMapping } from "@/features/mappings/queries";
import type { MappingRow } from "@/features/mappings/types";
import type { CustomerRow } from "@/features/customers/types";
import type { ProductRow } from "@/features/products/types";

/**
 * Create or edit a customer x product mapping.
 *
 * On EDIT the pair itself is fixed: changing which customer or which product a
 * mapping refers to would silently rewrite every projection line that resolves
 * through it. Deleting and re-creating makes that consequence visible, so the
 * two selects are read-only here.
 */
export function MappingFormModal({
  open,
  onClose,
  editing,
  customers,
  products,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit mode. Absent = create. */
  editing?: MappingRow | null;
  customers: CustomerRow[];
  products: ProductRow[];
}) {
  const create = useCreateMapping();
  const update = useUpdateMapping();
  const isEdit = !!editing;
  const pending = create.isPending || update.isPending;

  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setErrorMessage("");
    setCustomerId(editing?.customerId ?? customers[0]?.id ?? "");
    setProductId(editing?.productId ?? products[0]?.id ?? "");
    setCustomPrice(
      editing?.customPrice != null ? String(editing.customPrice) : "",
    );
  }, [open, editing, customers, products]);

  const selectedProduct = products.find((p) => p.id === productId);
  const basePrice = isEdit ? editing?.basePrice : (selectedProduct?.basePrice ?? null);

  // Preview only. The server resolves effectivePrice and its answer is the one
  // that counts — this is here so the user can see what they are choosing.
  const parsedOverride = customPrice.trim() ? Number(customPrice) : null;
  const previewEffective =
    parsedOverride != null && !isNaN(parsedOverride) ? parsedOverride : basePrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!isEdit && (!customerId || !productId)) {
      setErrorMessage("Pick both a customer and a product.");
      return;
    }
    if (parsedOverride !== null && (isNaN(parsedOverride) || parsedOverride < 0)) {
      setErrorMessage("Agreed price must be a non-negative number.");
      return;
    }

    try {
      setErrorMessage("");
      if (isEdit && editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: { customPrice: parsedOverride },
        });
      } else {
        await create.mutateAsync({
          customerId,
          productId,
          customPrice: parsedOverride,
        });
      }
      onClose();
    } catch (err) {
      // The API's coded errors are the useful ones — MAPPING_EXISTS in
      // particular, where the duplicate may be soft-deleted and invisible.
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : "Could not save the mapping. Please try again.",
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit mapping" : "Map a product to a customer"}
      description={
        isEdit
          ? "Change the agreed price for this customer."
          : "Record that this customer buys this product. Projection lines are built from these."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="mapping-customer" className="mb-1 block text-sm font-medium">
            Customer
          </label>
          <Select
            id="mapping-customer"
            value={customerId}
            disabled={isEdit}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="mapping-product" className="mb-1 block text-sm font-medium">
            Product
          </label>
          <Select
            id="mapping-product"
            value={productId}
            disabled={isEdit}
            onChange={(e) => setProductId(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.sku ? ` (${p.sku})` : ""}
              </option>
            ))}
          </Select>
          {isEdit && (
            <p className="mt-1 text-xs text-muted">
              The pair cannot be changed — projection lines resolve through it.
              Delete and re-create instead.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="mapping-price" className="mb-1 block text-sm font-medium">
            Agreed price <span className="text-muted">(optional)</span>
          </label>
          <Input
            id="mapping-price"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder={basePrice != null ? String(basePrice) : "Catalog price"}
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            {basePrice != null
              ? `Catalog price ${inr(basePrice)}.`
              : "This product has no catalog price."}{" "}
            Leave blank to use it.
            {previewEffective != null && (
              <> This customer would pay <strong>{inr(previewEffective)}</strong>.</>
            )}
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg bg-red-soft/80 border border-red/30 p-2.5 text-xs text-red font-medium flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create mapping"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
