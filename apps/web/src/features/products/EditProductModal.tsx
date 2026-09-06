import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
import { ApiError } from "@/lib/api";
import { useDeleteProduct, useUpdateProduct } from "@/features/products/queries";
import { DeleteAction } from "@/components/modals/DeleteAction";
import type {
  DivisionValue,
  PrincipalRow,
  ProductRow,
  ProductUpdate,
} from "@/features/products/types";

/**
 * Units offered by the picker. Existing rows may carry a value outside this
 * list (older data, a different casing such as "kg", or an import), so the
 * select is widened with the row's own value rather than silently resetting it
 * to "Unset" — which would blank a real unit on the next save.
 */
const UNIT_OPTIONS = [
  { value: "Ltr", label: "Litre (Ltr)" },
  { value: "Kg", label: "Kilogram (Kg)" },
  { value: "Pcs", label: "Pieces (Pcs)" },
  { value: "Drum", label: "Drum (208L)" },
  { value: "Can", label: "Can (20L)" },
  { value: "Box", label: "Box / Carton" },
  { value: "Set", label: "Set / Kit" },
];

/**
 * Edit an existing catalog product. Mirrors {@link AddProductModal}'s form and
 * validation, but PATCHes only the fields the user actually changed so a
 * concurrent edit to an untouched field is not clobbered by a full overwrite.
 */
export function EditProductModal({
  open,
  onClose,
  product,
  principals = [],
}: {
  open: boolean;
  onClose: () => void;
  product: ProductRow | null;
  principals?: PrincipalRow[];
}) {
  const update = useUpdateProduct();
  const del = useDeleteProduct();

  const [principalId, setPrincipalId] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [division, setDivision] = useState<DivisionValue | "">("");
  const [unit, setUnit] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [active, setActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setPrincipalId(product.principalId);
    setName(product.name);
    setSku(product.sku ?? "");
    setDivision(product.division ?? "");
    setUnit(product.unit ?? "");
    setListPrice(product.basePrice != null ? String(product.basePrice) : "");
    setActive(product.active);
    setErrorMessage("");
    setShowDiscardConfirm(false);
  }, [open, product?.id, product?.updatedAt]);

  const isDirty = useMemo(() => {
    if (!product) return false;
    const currentPrice = listPrice.trim() ? Number(listPrice) : null;
    return (
      name.trim() !== product.name ||
      principalId !== product.principalId ||
      (sku.trim() || null) !== product.sku ||
      (division || null) !== product.division ||
      (unit.trim() || null) !== product.unit ||
      currentPrice !== product.basePrice ||
      active !== product.active
    );
  }, [product, name, principalId, sku, division, unit, listPrice, active]);

  const handleAttemptClose = () => {
    if (update.isPending) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      setErrorMessage("");
      onClose();
    }
  };

  const handleForceClose = () => {
    setErrorMessage("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !name.trim() || update.isPending) return;

    const priceNum = listPrice.trim() ? Number(listPrice) : null;
    if (priceNum !== null && (isNaN(priceNum) || priceNum < 0)) {
      setErrorMessage("Please enter a valid non-negative selling price.");
      return;
    }

    // Only send what changed — an empty patch is rejected by ProductUpdateSchema.
    const patch: ProductUpdate = {};
    if (name.trim() !== product.name) patch.name = name.trim();
    if (principalId !== product.principalId) patch.principalId = principalId;
    const nextSku = sku.trim() || null;
    if (nextSku !== product.sku) patch.sku = nextSku;
    const nextDivision = division || null;
    if (nextDivision !== product.division) patch.division = nextDivision;
    const nextUnit = unit.trim() || null;
    if (nextUnit !== product.unit) patch.unit = nextUnit;
    if (priceNum !== product.basePrice) patch.basePrice = priceNum;
    if (active !== product.active) patch.active = active;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    try {
      setErrorMessage("");
      await update.mutateAsync({ id: product.id, patch });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to save product. Please try again.");
      }
    }
  };

  const unitOptions = useMemo(
    () =>
      !unit || UNIT_OPTIONS.some((o) => o.value === unit)
        ? UNIT_OPTIONS
        : [{ value: unit, label: unit }, ...UNIT_OPTIONS],
    [unit],
  );

  const shortUnit = unit ? unit.split(" ")[0] : "unit";

  if (!product) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={handleAttemptClose}
        title={
          <div className="flex items-center gap-2">
            <Pencil className="h-4.5 w-4.5 text-brand shrink-0" />
            <span>Edit Catalog Product</span>
          </div>
        }
        description="Update SKU, principal brand mapping, unit of measure, or benchmark price."
        maxWidth="max-w-xl"
        footer={
          <>
            <DeleteAction
              label="Delete Product"
              title={`Delete ${product.name}?`}
              body="The SKU is removed from the catalog. Existing orders and mappings that reference it keep their own copy of the line, so history is not rewritten."
              onDelete={() => del.mutateAsync(product.id)}
              onDeleted={onClose}
              disabled={update.isPending}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAttemptClose}
              type="button"
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || update.isPending}>
              {update.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg bg-red-soft/80 border border-red/30 p-2.5 text-xs text-red font-medium flex items-center gap-2 animate-in fade-in-50"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 2-Column Responsive Form Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
            <div>
              <label
                htmlFor="edit-product-principal"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Principal Brand <span className="text-red font-semibold" aria-hidden="true">*</span>
              </label>
              <Select
                id="edit-product-principal"
                className="w-full"
                selectClassName="w-full h-9"
                value={principalId}
                onChange={(e) => {
                  setPrincipalId(e.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                disabled={update.isPending || principals.length === 0}
              >
                {principals.length === 0 ? (
                  <option value={product.principalId}>{product.principalName}</option>
                ) : (
                  principals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                )}
              </Select>
            </div>

            <div>
              <label
                htmlFor="edit-product-name"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Product Name <span className="text-red font-semibold" aria-hidden="true">*</span>
              </label>
              <Input
                id="edit-product-name"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                disabled={update.isPending}
                className="h-9"
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label
                  htmlFor="edit-product-sku"
                  className="text-xs font-semibold text-ink"
                >
                  Product SKU / Code
                </label>
                <span className="text-[11px] text-muted font-normal">(Optional)</span>
              </div>
              <Input
                id="edit-product-sku"
                placeholder="e.g. CAS-HYS-50"
                value={sku}
                onChange={(e) => {
                  setSku(e.target.value.toUpperCase());
                  if (errorMessage) setErrorMessage("");
                }}
                className="h-9 uppercase font-mono text-xs"
                disabled={update.isPending}
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label
                  htmlFor="edit-product-price"
                  className="text-xs font-semibold text-ink"
                >
                  Default Benchmark Price
                </label>
                <span className="text-[11px] text-muted font-normal">(Optional)</span>
              </div>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 text-xs font-semibold text-muted select-none">
                  ₹
                </span>
                <Input
                  id="edit-product-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Leave blank for custom"
                  value={listPrice}
                  onChange={(e) => {
                    setListPrice(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  disabled={update.isPending}
                  className="h-9 pl-7 pr-16 tabular-nums text-xs"
                />
                <span className="pointer-events-none absolute right-3 text-[11px] font-semibold text-muted/70 select-none">
                  / {shortUnit}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="edit-product-division"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Division
              </label>
              <Select
                id="edit-product-division"
                className="w-full"
                selectClassName="w-full h-9"
                value={division}
                onChange={(e) => setDivision(e.target.value as DivisionValue | "")}
                disabled={update.isPending}
              >
                <option value="">Unassigned</option>
                <option value="LUB">Lubricants (LUB)</option>
                <option value="WES">Welding &amp; Equip (WES)</option>
              </Select>
            </div>

            <div>
              <label
                htmlFor="edit-product-unit"
                className="text-xs font-semibold text-ink block mb-1.5"
              >
                Unit of Measure
              </label>
              <Select
                id="edit-product-unit"
                className="w-full"
                selectClassName="w-full h-9"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={update.isPending}
              >
                <option value="">Unset</option>
                {unitOptions.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={update.isPending}
              className="h-3.5 w-3.5 rounded border-line accent-brand"
            />
            <span>Active in catalog</span>
          </label>
        </form>
      </Dialog>

      {/* Discard confirmation modal if user attempts to exit with unsaved edits */}
      <ConfirmActionModal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleForceClose}
        title="Discard unsaved changes?"
        body="You have edited product details. Closing now will discard all unsaved changes."
        confirmLabel="Discard Changes"
        destructive
      />
    </>
  );
}
