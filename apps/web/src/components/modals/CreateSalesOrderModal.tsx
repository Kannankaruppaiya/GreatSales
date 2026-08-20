import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  IndianRupee,
  MapPin,
  PackageCheck,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
import { Button, Dialog, Input, Select, Textarea } from "../ui";
import { DELIVERY_MODES, PAYMENT_TERMS, type DeliveryMode } from "../../data/constants";
import { inr } from "../../lib/format";
import { cn } from "../../lib/utils";
import { useTrackerStore } from "../../store/trackerStore";
import { useMockOwnerId } from "../../lib/mockOwner";

export function CreateSalesOrderModal({
  open,
  onClose,
  initialCustomerId,
  initialProductId,
  initialQty = 10,
  initialPrice,
  fromProjectionId,
}: {
  open: boolean;
  onClose: () => void;
  initialCustomerId?: string;
  initialProductId?: string;
  initialQty?: number;
  initialPrice?: number;
  fromProjectionId?: string;
}) {
  const { customers, products, users, createSalesOrder } = useTrackerStore();
  const ownerId = useMockOwnerId();

  const [customerId, setCustomerId] = useState(initialCustomerId || customers[0]?.id || "");
  const [productId, setProductId] = useState(initialProductId || products[0]?.id || "");
  const [qty, setQty] = useState<number>(initialQty || 10);
  const selectedProduct = products.find((p) => p.id === productId);
  const [price, setPrice] = useState<number>(initialPrice || selectedProduct?.listPrice || 100);

  const customer = customers.find((c) => c.id === customerId);

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("Transport (LR)");
  const [paymentTerm, setPaymentTerm] = useState<string>(
    customer?.paymentTerms || PAYMENT_TERMS[2] // 30 Days Credit
  );
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgentDateTime, setUrgentDateTime] = useState("");
  const [remarks, setRemarks] = useState("");

  // Sync initial props
  useEffect(() => {
    if (initialCustomerId) setCustomerId(initialCustomerId);
    if (initialProductId) setProductId(initialProductId);
    if (initialQty != null) setQty(initialQty);
    if (initialPrice != null) setPrice(initialPrice);
  }, [initialCustomerId, initialProductId, initialQty, initialPrice, open]);

  // Sync customer payment terms & area address if empty
  useEffect(() => {
    if (customer) {
      if (customer.paymentTerms) {
        setPaymentTerm(customer.paymentTerms);
      }
      if (!deliveryAddress && customer.area) {
        setDeliveryAddress(`${customer.name}, ${customer.area}`);
      }
    }
  }, [customer]);

  // Calculate financials
  const subtotal = Math.max(0, (qty || 0) * (price || 0));
  const gstRate = 0.18;
  const gstAmount = subtotal * gstRate;
  const grandTotal = subtotal + gstAmount;
  const unitName = selectedProduct?.unit || "Units";

  const handleUseCustomerAddress = () => {
    if (customer) {
      setDeliveryAddress(
        [customer.name, customer.contactName ? `Attn: ${customer.contactName}` : null, customer.area]
          .filter(Boolean)
          .join(", ")
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !productId || qty <= 0 || price < 0) return;

    createSalesOrder(
      {
        customerId,
        customerName: customer?.name,
        ownerId: customer?.ownerId || ownerId,
        status: "Created",
        lines: [
          {
            productId,
            productName: selectedProduct?.name || "Product",
            principalName: selectedProduct?.principalName,
            qty,
            price,
            unit: selectedProduct?.unit,
          },
        ],
        isUrgent,
        paymentTerm,
        deliveryMode,
        deliveryAddress: deliveryAddress.trim() || undefined,
        expectedDelivery: isUrgent ? urgentDateTime || null : null,
        deliveryInstructions: remarks.trim() || undefined,
        createdBy: users.find((u) => u.id === (customer?.ownerId || ownerId))?.name,
      },
      fromProjectionId
    );

    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand-soft text-brand-ink border border-brand/20 shadow-2xs">
            <PackageCheck className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-ink">Create Sales Order</span>
              {fromProjectionId && (
                <span className="rounded-full bg-brand-soft border border-brand/20 px-2 py-0.5 text-[10px] font-bold text-brand-ink">
                  From Projection
                </span>
              )}
            </div>
          </div>
        </div>
      }
      description={
        customer ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Building2 className="h-3 w-3 text-muted" />
            <span className="font-semibold text-ink">{customer.name}</span>
            {customer.tier && (
              <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[10px] font-bold text-muted border border-line">
                {customer.tier} Tier
              </span>
            )}
            {selectedProduct && (
              <>
                <span className="text-muted/60">·</span>
                <span className="text-muted">{selectedProduct.name}</span>
              </>
            )}
          </span>
        ) : (
          "Issue a verified commercial sales order for fulfillment"
        )
      }
      maxWidth="max-w-2xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted font-medium">Order Total:</span>
            <span className="text-base font-extrabold text-brand tabular-nums">
              {inr(grandTotal)}
            </span>
            <span className="text-[10px] text-muted">(incl. 18% GST)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!customerId || !productId || qty <= 0}
              className="font-bold shadow-xs gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Create Sales Order
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Section 1: Customer & SKU Selection */}
        <div className="rounded-xl border border-line bg-surface-2/30 p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <Building2 className="h-3.5 w-3.5 text-brand" />
            <span>Account & Product Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink flex items-center justify-between mb-1.5">
                <span>Customer <span className="text-red">*</span></span>
                {customer?.area && (
                  <span className="text-[11px] text-muted font-normal flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" /> {customer.area}
                  </span>
                )}
              </label>
              <Select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="w-full"
                selectClassName="h-9 font-medium"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.tier ? `(${c.tier})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink flex items-center justify-between mb-1.5">
                <span>Product SKU <span className="text-red">*</span></span>
                {selectedProduct?.principalName && (
                  <span className="text-[11px] text-brand-ink font-semibold bg-brand-soft px-1.5 py-0.2 rounded border border-brand/20">
                    {selectedProduct.principalName}
                  </span>
                )}
              </label>
              <Select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  const prod = products.find((p) => p.id === e.target.value);
                  if (prod) setPrice(prod.listPrice);
                }}
                required
                className="w-full"
                selectClassName="h-9 font-medium"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.principalName || "Standard"} (₹{p.listPrice}/{p.unit})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Section 2: Order Commercials & Quantity */}
        <div className="rounded-xl border border-line bg-surface p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <IndianRupee className="h-3.5 w-3.5 text-brand" />
              <span>Commercials & Quantity</span>
            </div>
            <span className="text-[11px] text-muted font-medium">
              UoM: <strong className="text-ink font-bold">{unitName}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Quantity */}
            <div className="sm:col-span-3">
              <label className="text-xs font-semibold text-ink block mb-1.5">
                Quantity ({unitName}) <span className="text-red">*</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={qty || ""}
                  onChange={(e) => setQty(Number(e.target.value))}
                  placeholder="10"
                  className="font-bold tabular-nums pr-10 text-sm h-9"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted uppercase">
                  {unitName}
                </span>
              </div>
            </div>

            {/* Unit Price */}
            <div className="sm:col-span-4">
              <label className="text-xs font-semibold text-ink flex items-center justify-between mb-1.5">
                <span>Unit Rate (₹) <span className="text-red">*</span></span>
                {selectedProduct?.listPrice && price !== selectedProduct.listPrice && (
                  <span className="text-[10px] text-muted line-through">
                    List ₹{selectedProduct.listPrice}
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
                  ₹
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={price != null ? price : ""}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  placeholder="Rate"
                  className="font-bold tabular-nums pl-7 text-sm h-9"
                />
              </div>
            </div>

            {/* Financial Summary Box */}
            <div className="sm:col-span-5 rounded-lg border border-brand/20 bg-brand-soft/40 p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>Subtotal ({qty || 0} {unitName})</span>
                <span className="font-semibold text-ink tabular-nums">{inr(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted mt-0.5">
                <span>GST (18%)</span>
                <span className="font-semibold text-ink tabular-nums">{inr(gstAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-extrabold text-brand-ink pt-1.5 mt-1 border-t border-brand/20">
                <span>Gross Total</span>
                <span className="text-sm tabular-nums text-brand">{inr(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Delivery & Logistics */}
        <div className="rounded-xl border border-line bg-surface p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <Truck className="h-3.5 w-3.5 text-brand" />
              <span>Logistics & Dispatch Priority</span>
            </div>

            {/* Normal vs Urgent Toggle */}
            <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-0.5 border border-line">
              <button
                type="button"
                onClick={() => setIsUrgent(false)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer",
                  !isUrgent
                    ? "bg-surface text-ink shadow-2xs"
                    : "text-muted hover:text-ink"
                )}
              >
                <Clock className="h-3 w-3" /> Standard
              </button>
              <button
                type="button"
                onClick={() => setIsUrgent(true)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-all cursor-pointer",
                  isUrgent
                    ? "bg-amber text-white shadow-2xs"
                    : "text-amber hover:bg-amber-soft"
                )}
              >
                <Zap className="h-3 w-3" /> Urgent SLA
              </button>
            </div>
          </div>

          {/* Urgent Alert Banner & Expected Date */}
          {isUrgent && (
            <div className="rounded-lg border border-amber/50 bg-amber-soft/80 p-3 space-y-2 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 fill-amber" /> Time-Sensitive Delivery Commitment
                </span>
                <span className="text-[10px] font-semibold text-amber/80 uppercase tracking-wider">High Priority</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink block mb-1">
                  Expected Delivery Date & Time <span className="text-red">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={urgentDateTime}
                  onChange={(e) => setUrgentDateTime(e.target.value)}
                  required={isUrgent}
                  className="bg-surface h-9 font-medium"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink block mb-1.5">
                Mode of Delivery
              </label>
              <Select
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}
                className="w-full"
                selectClassName="h-9 font-medium"
              >
                {DELIVERY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink block mb-1.5">
                Payment Terms
              </label>
              <Select
                value={paymentTerm}
                onChange={(e) => setPaymentTerm(e.target.value)}
                className="w-full"
                selectClassName="h-9 font-medium"
              >
                {PAYMENT_TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted" /> Delivery Site Address
              </label>
              {customer?.area && (
                <button
                  type="button"
                  onClick={handleUseCustomerAddress}
                  className="text-[11px] font-semibold text-brand hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <Sparkles className="h-2.5 w-2.5" /> Auto-fill customer address
                </button>
              )}
            </div>
            <Textarea
              rows={2}
              placeholder="Full site / warehouse delivery address with contact person details…"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="text-xs resize-none"
            />
          </div>
        </div>

        {/* Section 4: Remarks / PO Reference */}
        <div>
          <label className="text-xs font-semibold text-ink flex items-center gap-1 mb-1.5">
            <FileText className="h-3 w-3 text-muted" /> Order Remarks / PO Reference
          </label>
          <Textarea
            rows={2}
            placeholder="Special packing instructions, customer PO number, transporter notes…"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="text-xs resize-none"
          />
        </div>
      </form>
    </Dialog>
  );
}

