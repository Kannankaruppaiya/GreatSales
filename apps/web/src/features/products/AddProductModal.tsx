import { useState } from "react";
import { Boxes } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useCreateProduct } from "@/features/products/queries";

export interface PrincipalOption {
  id: string;
  name: string;
}

export function AddProductModal({
  open,
  onClose,
  principals = [],
}: {
  open: boolean;
  onClose: () => void;
  principals?: PrincipalOption[];
}) {
  const create = useCreateProduct();

  const [principalId, setPrincipalId] = useState("");
  const [name, setName] = useState("");
  const [listPrice, setListPrice] = useState<string>("");

  const selectedPrincipalId = principalId || principals[0]?.id || "";
  const selectedPrincipal = principals.find((p) => p.id === selectedPrincipalId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedPrincipalId) return;

    const priceNum = listPrice.trim() ? Number(listPrice) : null;
    const generatedSku = `${(selectedPrincipal?.name || "PR").slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      await create.mutateAsync({
        name: name.trim(),
        principalId: selectedPrincipalId,
        sku: generatedSku,
        division: "LUB",
        unit: "Ltr",
        basePrice: priceNum,
        active: true,
      });

      setName("");
      setListPrice("");
      setPrincipalId("");
      onClose();
    } catch {
      // Surfaced inline below via create.error.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-brand" />
          <span>Add New Product</span>
        </div>
      }
      description="Add a sub-product under a principal; default price will flow to new projections"
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || !selectedPrincipalId || create.isPending}
          >
            {create.isPending ? "Adding…" : "Add Product"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Principal *
          </label>
          {principals.length === 0 ? (
            <p className="text-[11px] text-muted">
              No principals yet — add a product for an existing principal first.
            </p>
          ) : (
            <Select value={selectedPrincipalId} onChange={(e) => setPrincipalId(e.target.value)}>
              {principals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Sub Product Name *
          </label>
          <Input
            required
            placeholder="e.g. Hysol MB 50"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Default Selling Price ₹ (Optional)
          </label>
          <Input
            type="number"
            step="0.01"
            placeholder="e.g. 450"
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value)}
          />
        </div>

        {create.isError && (
          <p className="text-[11.5px] font-medium text-red">
            {create.error instanceof ApiError ? create.error.message : "Failed to add product."}
          </p>
        )}
      </form>
    </Dialog>
  );
}
