import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  IndianRupee,
  MapPin,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { DateTimeField } from "@/components/DateField";
import { ApiError } from "@/lib/api";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
import { useCreateOrder } from "@/features/orders/queries";
import { DELIVERY_MODE_VALUES, DELIVERY_MODE_LABELS, type DeliveryModeValue } from "@/features/orders/types";
import { useCustomers, flattenCustomers } from "@/features/customers/queries";
import { useProducts, flattenProducts } from "@/features/products/queries";
import { useUserDirectory } from "@/features/users/queries";
import { useAuthRole, useAuthUser } from "@/store/auth";

export interface OrderCustomerOption {
  id: string;
  name: string;
  paymentTerms?: string | null;
  area?: string | null;
  primaryContactName?: string | null;
}

export interface OrderProductOption {
  id: string;
  name: string;
  principalName?: string | null;
  price?: number | null;
  unit?: string | null;
}

export interface OrderSalespersonOption {
  id: string;
  name: string;
}

function defaultCode(): string {
  return `SO-${Date.now()}`;
}

export function CreateSalesOrderModal({
  open,
  onClose,
  customers,
  products,
  salespeople,
  initialCustomerId,
  initialProductId,
  initialQty = 10,
  initialPrice,
  fromProjectionId,
}: {
  open: boolean;
  onClose: () => void;
  customers?: OrderCustomerOption[];
  products?: OrderProductOption[];
  salespeople?: OrderSalespersonOption[];
  initialCustomerId?: string;
  initialProductId?: string;
  initialQty?: number;
  initialPrice?: number;
  fromProjectionId?: string;
}) {
  const create = useCreateOrder();
  const role = useAuthRole();
  const authUser = useAuthUser();
  const isSales = role === "sales";

  const needsOwnFetch = customers === undefined;
  const needsOwnSalespeopleFetch = salespeople === undefined && !isSales;
  const customersQuery = useCustomers({}, { enabled: needsOwnFetch && open });
  const productsQuery = useProducts({}, { enabled: needsOwnFetch && open });
  const usersQuery = useUserDirectory({ enabled: needsOwnSalespeopleFetch && open });

  const fetchedCustomers = useMemo(
    () =>
      flattenCustomers(customersQuery.data).map((c) => ({
        id: c.id,
        name: c.name,
        paymentTerms: c.paymentTerms,
        area: c.area,
        primaryContactName: c.primaryContactName,
      })),
    [customersQuery.data],
  );
  const fetchedProducts = useMemo(
    () =>
      flattenProducts(productsQuery.data).map((p) => ({
        id: p.id,
        name: p.name,
        principalName: p.principalName,
        price: p.basePrice,
        unit: p.unit,
      })),
    [productsQuery.data],
  );
  const fetchedSalespeople = useMemo(
    () =>
      (usersQuery.data ?? [])
        .filter((u) => u.roleName === "sales")
        .map((u) => ({ id: u.id, name: u.name })),
    [usersQuery.data],
  );

  const customerOptions = customers ?? fetchedCustomers;
  const productOptions = products ?? fetchedProducts;
  const salespersonOptions = salespeople ?? fetchedSalespeople;
  const optionsLoading = needsOwnFetch && (customersQuery.isLoading || productsQuery.isLoading);
  const salespeopleLoading = needsOwnSalespeopleFetch && usersQuery.isLoading;

  const [code, setCode] = useState(defaultCode);
  // Nothing falls back to "the first option in the list" — see the reset
  // effect below for why that was the whole bug.
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [salespersonId, setSalespersonId] = useState(isSales ? authUser?.id || "" : "");
  const [productId, setProductId] = useState(initialProductId ?? "");
  const [qty, setQty] = useState<number>(initialQty || 10);
  const selectedProduct = productOptions.find((p) => p.id === productId);
  const [price, setPrice] = useState<number>(initialPrice ?? 0);

  const customer = customerOptions.find((c) => c.id === customerId);

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryModeValue>("TransportLR");
  const [paymentTerms, setPaymentTerms] = useState<string>("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [remarks, setRemarks] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  /**
   * A blank form, every time the dialog OPENS.
   *
   * This component stays mounted whether or not the dialog is showing — the
   * Dialog renders null when closed — so its state survived a close, and
   * `handleForceClose` reset eight fields while leaving the customer, product,
   * salesperson and price behind. Opening "Create Order" from the dashboard
   * therefore arrived carrying the account and SKU of the order raised before
   * it, already selected and one click from being raised again.
   *
   * Seeded from the props, so an order started from a projection still arrives
   * with that projection's customer and product filled in. A plain "Create
   * Order" has no such context and arrives empty.
   */
  useEffect(() => {
    if (!open) return;
    setCode(defaultCode());
    setCustomerId(initialCustomerId ?? "");
    setProductId(initialProductId ?? "");
    setSalespersonId(isSales ? authUser?.id || "" : "");
    setQty(initialQty || 10);
    setPrice(initialPrice ?? 0);
    setDeliveryAddress("");
    setDeliveryMode("TransportLR");
    setPaymentTerms("");
    setIsUrgent(false);
    setExpectedDelivery("");
    setRemarks("");
    setShowDiscardConfirm(false);
    // Deliberately keyed on `open` alone: this is "the dialog just opened",
    // not "a prop changed while the user was typing into it".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * A product handed down as a prop brings its price with it.
   *
   * The select's own onChange does this for a hand-picked product; this covers
   * the projection route, where the option list may still be loading when the
   * dialog opens. It cannot fight a typed price, because neither `productId`
   * nor the option list changes when somebody edits the rate.
   */
  useEffect(() => {
    if (!open || !productId || initialPrice != null) return;
    const p = productOptions.find((x) => x.id === productId);
    if (p?.price != null) setPrice(p.price);
  }, [open, productId, productOptions, initialPrice]);

  useEffect(() => {
    if (customer) {
      if (customer.paymentTerms && !paymentTerms) {
        setPaymentTerms(customer.paymentTerms);
      }
      if (!deliveryAddress && customer.area) {
        setDeliveryAddress(`${customer.name}, ${customer.area}`);
      }
    }
  }, [customer?.id, customer?.paymentTerms, customer?.area, customer?.name, paymentTerms, deliveryAddress]);

  // Calculate financials
  const subtotal = Math.max(0, (qty || 0) * (price || 0));
  const gstRate = 0.18;
  const gstAmount = subtotal * gstRate;
  const grandTotal = subtotal + gstAmount;
  const unitName = selectedProduct?.unit || "Units";

  const handleUseCustomerAddress = () => {
    if (customer) {
      setDeliveryAddress(
        [customer.name, customer.primaryContactName ? `Attn: ${customer.primaryContactName}` : null, customer.area]
          .filter(Boolean)
          .join(", ")
      );
    }
  };

  const isDirty =
    customerId !== (initialCustomerId ?? "") ||
    productId !== (initialProductId ?? "") ||
    deliveryAddress.trim() !== "" ||
    paymentTerms.trim() !== "" ||
    remarks.trim() !== "" ||
    isUrgent ||
    expectedDelivery !== "" ||
    qty !== (initialQty || 10);

  const handleAttemptClose = () => {
    if (isDirty && !create.isPending) {
      setShowDiscardConfirm(true);
    } else {
      handleForceClose();
    }
  };

  const handleForceClose = () => {
    setShowDiscardConfirm(false);
    setCode(defaultCode());
    setQty(initialQty || 10);
    setDeliveryAddress("");
    setDeliveryMode("TransportLR");
    setPaymentTerms("");
    setIsUrgent(false);
    setExpectedDelivery("");
    setRemarks("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !customerId || !salespersonId || !productId || qty <= 0 || price < 0) return;

    try {
      await create.mutateAsync({
        code: code.trim(),
        customerId,
        salespersonId,
        items: [
          {
            productId,
            qty,
            price,
            unit: selectedProduct?.unit ?? undefined,
          },
        ],
        isUrgent,
        paymentTerms: paymentTerms.trim() || null,
        deliveryMode,
        deliveryAddress: deliveryAddress.trim() || null,
        // Sent for every order, not only urgent ones. It used to be discarded
        // unless the urgent toggle was on, which left the Fulfilment SLA
        // report's "Delayed / On time" verdict with no input at all on a
        // standard order — the overwhelming majority of them.
        expectedDelivery: expectedDelivery || null,
        deliveryInstructions: remarks.trim() || null,
        // The projection line this order came from, when it came from one.
        // Until this was sent the prop only changed the dialog's title: the
        // order was created with nothing tying it back, and the worksheet's
        // sales-order column had no id to show.
        ...(fromProjectionId ? { projectionId: fromProjectionId } : {}),
      });

      handleForceClose();
    } catch {
      // Surfaced inline below via create.error.
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleAttemptClose}
        title={fromProjectionId ? "Create Sales Order (From Projection)" : "Create Sales Order"}
        description={
          customer
            ? `Issue sales order for ${customer.name}${selectedProduct ? ` · ${selectedProduct.name}` : ""}`
            : "Issue a verified commercial sales order for fulfillment."
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleAttemptClose}
                type="button"
                disabled={create.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!code.trim() || !customerId || !salespersonId || !productId || qty <= 0 || create.isPending}
                className="font-bold shadow-xs gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {create.isPending ? "Creating…" : "Create Sales Order"}
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
                <label htmlFor="so-code" className="text-xs font-semibold text-ink block mb-1.5">
                  SO Code <span className="text-red">*</span>
                </label>
                <Input
                  id="so-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  placeholder="SO-1001"
                  className="font-bold h-9"
                  disabled={create.isPending}
                />
              </div>

              <div>
                <label htmlFor="so-salesperson" className="text-xs font-semibold text-ink block mb-1.5">
                  Salesperson <span className="text-red">*</span>
                </label>
                {isSales ? (
                  <div className="font-semibold text-ink p-2 rounded-lg bg-surface border border-line h-9 flex items-center">
                    Assigned to you
                  </div>
                ) : salespeopleLoading ? (
                  <p className="text-[11px] text-muted py-2">Loading salespersons…</p>
                ) : salespersonOptions.length === 0 ? (
                  <p className="text-[11px] text-muted py-2">No salespersons yet.</p>
                ) : (
                  <Select
                    id="so-salesperson"
                    value={salespersonId}
                    onChange={(e) => setSalespersonId(e.target.value)}
                    required
                    className="w-full"
                    selectClassName="h-9 font-medium"
                    disabled={create.isPending}
                  >
                    <option value="">— Choose a salesperson —</option>
                    {salespersonOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="so-customer" className="text-xs font-semibold text-ink flex items-center justify-between mb-1.5">
                  <span>Customer <span className="text-red">*</span></span>
                  {customer?.area && (
                    <span className="text-[11px] text-muted font-normal flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" /> {customer.area}
                    </span>
                  )}
                </label>
                {optionsLoading ? (
                  <p className="text-[11px] text-muted py-2">Loading customers…</p>
                ) : customerOptions.length === 0 ? (
                  <p className="text-[11px] text-muted py-2">No customers yet.</p>
                ) : (
                  <Select
                    id="so-customer"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    required
                    className="w-full"
                    selectClassName="h-9 font-medium"
                    disabled={create.isPending}
                  >
                    {/* No pre-selected account. The first customer
                        alphabetically is not a choice anybody made, and this
                        form is one click from raising a real order against
                        whoever it lands on. */}
                    <option value="">— Choose a customer —</option>
                    {customerOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              <div>
                <label htmlFor="so-product" className="text-xs font-semibold text-ink flex items-center justify-between mb-1.5">
                  <span>Product SKU <span className="text-red">*</span></span>
                  {selectedProduct?.principalName && (
                    <span className="text-[11px] text-brand-ink font-semibold bg-brand-soft px-1.5 py-0.5 rounded border border-brand/20">
                      {selectedProduct.principalName}
                    </span>
                  )}
                </label>
                {optionsLoading ? (
                  <p className="text-[11px] text-muted py-2">Loading products…</p>
                ) : productOptions.length === 0 ? (
                  <p className="text-[11px] text-muted py-2">No products yet.</p>
                ) : (
                  <Select
                    id="so-product"
                    value={productId}
                    onChange={(e) => {
                      setProductId(e.target.value);
                      const prod = productOptions.find((p) => p.id === e.target.value);
                      if (prod?.price != null) setPrice(prod.price);
                    }}
                    required
                    className="w-full"
                    selectClassName="h-9 font-medium"
                    disabled={create.isPending}
                  >
                    <option value="">— Choose a product —</option>
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.principalName ? `· ${p.principalName}` : ""} {p.price != null ? `(₹${p.price}/${p.unit || "unit"})` : ""}
                      </option>
                    ))}
                  </Select>
                )}
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
                <label htmlFor="so-qty" className="text-xs font-semibold text-ink block mb-1.5">
                  Quantity ({unitName}) <span className="text-red">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="so-qty"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={qty || ""}
                    onChange={(e) => setQty(Number(e.target.value))}
                    placeholder="10"
                    className="font-bold tabular-nums pr-10 text-sm h-9"
                    disabled={create.isPending}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted uppercase">
                    {unitName}
                  </span>
                </div>
              </div>

              {/* Unit Price */}
              <div className="sm:col-span-4">
                <label htmlFor="so-price" className="text-xs font-semibold text-ink flex items-center justify-between mb-1.5">
                  <span>Unit Rate (₹) <span className="text-red">*</span></span>
                  {selectedProduct?.price != null && price !== selectedProduct.price && (
                    <span className="text-[10px] text-muted line-through">
                      List ₹{selectedProduct.price}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
                    ₹
                  </span>
                  <Input
                    id="so-price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price != null ? price : ""}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    placeholder="Rate"
                    className="font-bold tabular-nums pl-7 text-sm h-9"
                    disabled={create.isPending}
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

            {/* The delivery commitment — asked for on EVERY order, because it
                is the only thing the Fulfilment SLA report can judge a
                delivery against. Behind the urgent toggle it was collected on
                a small minority of orders and the report's "Delayed / On time"
                column had nothing to work with on the rest. Urgent keeps the
                banner and makes it required; standard asks for it plainly. */}
            <div
              className={cn(
                "rounded-lg p-3 space-y-2",
                isUrgent
                  ? "border border-amber/50 bg-amber-soft/80 animate-in fade-in-50 duration-150"
                  : "border border-line bg-surface-2/50"
              )}
            >
              {isUrgent && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 fill-amber" /> Time-Sensitive Delivery Commitment
                  </span>
                  <span className="text-[10px] font-semibold text-amber/80 uppercase tracking-wider">High Priority</span>
                </div>
              )}
              <div>
                <label htmlFor="so-expected-delivery" className="text-xs font-semibold text-ink block mb-1">
                  Expected Delivery Date &amp; Time{" "}
                  {isUrgent ? <span className="text-red">*</span> : (
                    <span className="font-normal text-muted">(optional)</span>
                  )}
                </label>
                <DateTimeField
                  id="so-expected-delivery"
                  label="Expected delivery"
                  value={expectedDelivery}
                  onChange={setExpectedDelivery}
                  required={isUrgent}
                />
                {!isUrgent && (
                  <p className="mt-1 text-3xs text-muted">
                    Drives the Delayed / On&nbsp;time verdict on the Fulfilment SLA report.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="so-delivery-mode" className="text-xs font-semibold text-ink block mb-1.5">
                  Mode of Delivery
                </label>
                <Select
                  id="so-delivery-mode"
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value as DeliveryModeValue)}
                  className="w-full"
                  selectClassName="h-9 font-medium"
                >
                  {DELIVERY_MODE_VALUES.map((m) => (
                    <option key={m} value={m}>
                      {DELIVERY_MODE_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="so-payment-terms" className="text-xs font-semibold text-ink block mb-1.5">
                  Payment Terms
                </label>
                <Input
                  id="so-payment-terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. 30 Days Credit"
                  className="h-9 font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="so-delivery-address" className="text-xs font-semibold text-ink flex items-center gap-1">
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
                id="so-delivery-address"
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
            <label htmlFor="so-remarks" className="text-xs font-semibold text-ink flex items-center gap-1 mb-1.5">
              <FileText className="h-3 w-3 text-muted" /> Order Remarks / PO Reference
            </label>
            <Textarea
              id="so-remarks"
              rows={2}
              placeholder="Special packing instructions, customer PO number, transporter notes…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          {create.isError && (
            <p role="alert" className="text-[11.5px] font-medium text-red">
              {create.error instanceof ApiError ? create.error.message : "Failed to create sales order."}
            </p>
          )}
        </form>
      </Dialog>

      <ConfirmActionModal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Sales Order Changes?"
        body="You have unsaved sales order details entered. Are you sure you want to discard your changes?"
        confirmLabel="Discard Changes"
        destructive
        onConfirm={handleForceClose}
      />
    </>
  );
}

