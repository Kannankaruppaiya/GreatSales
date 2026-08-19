import { useState } from "react";
import { Boxes } from "lucide-react";
import { Button, Dialog, Input, Select } from "../ui";
import { useTrackerStore } from "../../store/trackerStore";

export function AddProductModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { principals, addProduct } = useTrackerStore();

  const [principalId, setPrincipalId] = useState(principals[0]?.id || "pr_castrol");
  const [name, setName] = useState("");
  const [listPrice, setListPrice] = useState<string>("");

  const selectedPrincipal = principals.find((p) => p.id === principalId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const priceNum = listPrice.trim() ? Number(listPrice) : 0;
    const generatedSku = `${(selectedPrincipal?.name || "PR").slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    addProduct({
      name: name.trim(),
      sku: generatedSku,
      principalId,
      principalName: selectedPrincipal?.name,
      division: "LUB",
      unit: "Ltr",
      listPrice: priceNum,
      active: true,
    });

    setName("");
    setListPrice("");
    onClose();
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
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim()}>
            Add Product
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Principal *
          </label>
          <Select value={principalId} onChange={(e) => setPrincipalId(e.target.value)}>
            {principals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
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
      </form>
    </Dialog>
  );
}
