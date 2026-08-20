import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { useTrackerStore } from "@/store/trackerStore";
import { useUi } from "@/store/ui";
import { useAuthRole } from "@/store/auth";
import { useMockOwnerId } from "@/lib/mockOwner";

export function AddMappingModal({
  open,
  onClose,
  initialCustomerId,
}: {
  open: boolean;
  onClose: () => void;
  initialCustomerId?: string;
}) {
  const { customers, principals, products, users, addProjection, projections } = useTrackerStore();
  const { month } = useUi();
  const ownerId = useMockOwnerId();
  const role = useAuthRole();
  const salespeople = users.filter((u) => u.role === "sales");

  const [customerId, setCustomerId] = useState(initialCustomerId || customers[0]?.id || "");
  const [custSearch, setCustSearch] = useState("");

  useEffect(() => {
    if (initialCustomerId) {
      setCustomerId(initialCustomerId);
    } else if (customers[0]?.id) {
      setCustomerId(customers[0].id);
    }
  }, [initialCustomerId, open, customers]);

  const [principalId, setPrincipalId] = useState(principals[0]?.id || "pr_castrol");
  const filteredProducts = products.filter((p) => p.principalId === principalId);
  const [productId, setProductId] = useState(filteredProducts[0]?.id || products[0]?.id || "");
  const selectedProduct = products.find((p) => p.id === productId);
  const [price, setPrice] = useState<number>(selectedProduct?.listPrice || 380);
  const [projectedQty, setProjectedQty] = useState<number>(0);
  const [assignedOwnerId, setAssignedOwnerId] = useState(salespeople[0]?.id || ownerId);
  const [error, setError] = useState("");

  const handlePrincipalChange = (pId: string) => {
    setPrincipalId(pId);
    const prods = products.filter((p) => p.principalId === pId);
    if (prods.length > 0) {
      setProductId(prods[0].id);
      setPrice(prods[0].listPrice);
    }
  };

  const handleProductChange = (prodId: string) => {
    setProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) setPrice(prod.listPrice);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !productId) return;

    // Check duplicate mapping in current month
    const exists = projections.some(
      (p) => p.customerId === customerId && p.productId === productId && p.month === month
    );
    if (exists) {
      setError("This customer already has a projection line for this product in the selected month.");
      return;
    }

    addProjection({
      month,
      customerId,
      productId,
      ownerId: assignedOwnerId,
      projectedQty: projectedQty || 0,
      achievedQty: 0,
      price: price || selectedProduct?.listPrice || 0,
      customPrice: price || selectedProduct?.listPrice || 0,
      status: projectedQty > 0 ? "Projection Created" : "Deferred to Next Month",
      nextFollowUp: null,
      targetDate: null,
      salesOrderId: null,
    });

    setError("");
    onClose();
  };

  const filteredCusts = customers.filter(
    (c) => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase())
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-brand" />
          <span>Map Product to Customer</span>
        </div>
      }
      description="Create a product SKU mapping for recurring sales projections"
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!customerId || !productId}>
            Map Product
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="rounded-lg bg-red-soft p-2.5 text-xs text-red font-medium border border-red/30">
            {error}
          </div>
        )}

        {/* Customer Select */}
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Customer *
          </label>
          <input
            type="text"
            placeholder="Filter customers…"
            value={custSearch}
            onChange={(e) => setCustSearch(e.target.value)}
            className="w-full rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs mb-1.5 focus:outline-brand focus:border-brand"
          />
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            {filteredCusts.slice(0, 100).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.contactName ? `(${c.contactName})` : ""}
              </option>
            ))}
          </Select>
        </div>

        {/* Principal Select */}
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Principal
          </label>
          <Select value={principalId} onChange={(e) => handlePrincipalChange(e.target.value)}>
            {principals.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Sub Product Select */}
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Sub Product *
          </label>
          <Select value={productId} onChange={(e) => handleProductChange(e.target.value)} required>
            {filteredProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (₹{p.listPrice}/{p.unit})
              </option>
            ))}
          </Select>
        </div>

        {/* Agreed Price & Projected Qty */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Agreed Price ₹
            </label>
            <Input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              placeholder="Default price"
            />
            {selectedProduct && (
              <span className="text-[11px] text-muted block mt-1">
                List price: ₹{selectedProduct.listPrice}/{selectedProduct.unit}
              </span>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Initial Proj Qty
            </label>
            <Input
              type="number"
              value={projectedQty || ""}
              onChange={(e) => setProjectedQty(Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>

        {/* Salesperson (if admin) */}
        {role !== "sales" && (
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Salesperson
            </label>
            <Select value={assignedOwnerId} onChange={(e) => setAssignedOwnerId(e.target.value)}>
              {salespeople.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </form>
    </Dialog>
  );
}
