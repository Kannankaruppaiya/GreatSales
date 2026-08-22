import { useState, useEffect } from "react";
import { AlertCircle, Boxes, Loader2, Sparkles } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useCreateProduct } from "@/features/products/queries";
import type { DivisionValue, PrincipalRow } from "@/features/products/types";

export function AddProductModal({
  open,
  onClose,
  principals = [],
  onOpenAddPrincipal,
}: {
  open: boolean;
  onClose: () => void;
  principals?: PrincipalRow[];
  onOpenAddPrincipal?: () => void;
}) {
  const create = useCreateProduct();

  const [principalId, setPrincipalId] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [division, setDivision] = useState<DivisionValue>("LUB");
  const [unit, setUnit] = useState("Ltr");
  const [listPrice, setListPrice] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedPrincipalId = principalId || principals[0]?.id || "";
  const selectedPrincipal = principals.find((p) => p.id === selectedPrincipalId);

  // Auto-generate suggested SKU based on principal code and name initials
  const handleAutoSuggestSku = () => {
    const prefix = (selectedPrincipal?.name || "PR").replace(/[^A-Z0-9]/gi, "").slice(0, 3).toUpperCase();
    const namePrefix = name.trim().replace(/[^A-Z0-9]/gi, "").slice(0, 3).toUpperCase() || "SKU";
    const rand = Math.floor(100 + Math.random() * 900);
    setSku(`${prefix}-${namePrefix}-${rand}`);
    setErrorMessage("");
  };

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      if (principals.length > 0 && !principalId) {
        setPrincipalId(principals[0].id);
      }
      setErrorMessage("");
    }
  }, [open, principals, principalId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedPrincipalId || create.isPending) return;

    const priceNum = listPrice.trim() ? Number(listPrice) : null;
    if (priceNum !== null && (isNaN(priceNum) || priceNum < 0)) {
      setErrorMessage("Please enter a valid non-negative selling price.");
      return;
    }

    try {
      setErrorMessage("");
      await create.mutateAsync({
        name: name.trim(),
        principalId: selectedPrincipalId,
        sku: sku.trim() || null,
        division: division || "LUB",
        unit: unit.trim() || "Ltr",
        basePrice: priceNum,
        active: true,
      });

      setName("");
      setSku("");
      setListPrice("");
      setDivision("LUB");
      setUnit("Ltr");
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to add product. Please try again.");
      }
    }
  };

  const handleClose = () => {
    if (create.isPending) return;
    setErrorMessage("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="font-bold text-ink">Add New Catalog Product</span>
        </div>
      }
      description="Add a sub-product SKU under a principal brand with default pricing and units."
      maxWidth="max-w-lg"
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            type="button"
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || !selectedPrincipalId || create.isPending}
          >
            {create.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Saving Product…
              </>
            ) : (
              "Add Product"
            )}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        {errorMessage && (
          <div className="rounded-lg bg-red-soft/80 border border-red/30 p-2.5 text-xs text-red font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Principal Selection */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider">
              Principal Brand *
            </label>
            {onOpenAddPrincipal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddPrincipal();
                }}
                className="text-[11px] font-semibold text-brand hover:underline"
              >
                + New Brand
              </button>
            )}
          </div>
          {principals.length === 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 font-medium flex items-center justify-between">
              <span>No principals found. Please create a principal brand first.</span>
              {onOpenAddPrincipal && (
                <Button size="xs" onClick={() => { onClose(); onOpenAddPrincipal(); }} type="button">
                  Add Principal
                </Button>
              )}
            </div>
          ) : (
            <Select
              value={selectedPrincipalId}
              onChange={(e) => {
                setPrincipalId(e.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              disabled={create.isPending}
            >
              {principals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.productCount ? `(${p.productCount} products)` : ""}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Product Name */}
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Sub Product Name *
          </label>
          <Input
            required
            placeholder="e.g. Hysol MB 50 or Castrol Magnatec 5W-30"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errorMessage) setErrorMessage("");
            }}
            disabled={create.isPending}
          />
        </div>

        {/* SKU Field with Auto-Suggest Generator */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider">
              Product SKU / Part Number (Optional)
            </label>
            <button
              type="button"
              onClick={handleAutoSuggestSku}
              className="text-[11px] font-medium text-brand hover:text-brand-dark flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" /> Auto-suggest SKU
            </button>
          </div>
          <Input
            placeholder="e.g. CAS-HYS-50"
            value={sku}
            onChange={(e) => {
              setSku(e.target.value.toUpperCase());
              if (errorMessage) setErrorMessage("");
            }}
            className="uppercase font-mono text-xs"
            disabled={create.isPending}
          />
        </div>

        {/* Division & Unit Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Division
            </label>
            <Select
              value={division}
              onChange={(e) => setDivision(e.target.value as DivisionValue)}
              disabled={create.isPending}
            >
              <option value="LUB">Lubricants (LUB)</option>
              <option value="WES">Welding & Equip (WES)</option>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Unit of Measure
            </label>
            <Select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={create.isPending}
            >
              <option value="Ltr">Litre (Ltr)</option>
              <option value="Kg">Kilogram (Kg)</option>
              <option value="Pcs">Pieces (Pcs)</option>
              <option value="Drum">Drum (208L)</option>
              <option value="Can">Can (20L)</option>
              <option value="Box">Box / Carton</option>
              <option value="Set">Set / Kit</option>
            </Select>
          </div>
        </div>

        {/* Default Price */}
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Default Selling Price ₹ (Optional)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 450.00"
            value={listPrice}
            onChange={(e) => {
              setListPrice(e.target.value);
              if (errorMessage) setErrorMessage("");
            }}
            disabled={create.isPending}
            className="tabular-nums"
          />
          <p className="mt-1 text-[11px] text-muted">
            This benchmark price automatically pre-fills recurring projections and sales orders.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
