/**
 * Wire types for the orders (sales order) API. These mirror the
 * `@greatsales/shared` OrderRow / OrderListResponse contracts; kept as a
 * local copy so the Vite build does not need to consume the CJS `shared`
 * dist. The API is the source of truth — keep this in sync with
 * packages/shared/src/order.ts.
 *
 * `subtotal`, `taxAmount`, `total` and `items[].lineTotal` are all computed
 * server-side from the order's items and its tax mode (see the order-engine) —
 * they are never part of OrderCreate/OrderUpdate and must be rendered exactly
 * as received, never recomputed or sent back to the API. `total` is the GRAND
 * total, GST included; a client that wants the pre-tax figure reads `subtotal`
 * rather than subtracting. `statusHistory` is likewise a read-only nested list;
 * a status change is driven by OrderUpdate.status (+ optional statusNote),
 * which the API appends to the trail itself.
 */

export interface OrderItemInput {
  productId: string;
  qty: number;
  price: number;
  unit?: string | null;
}

export interface OrderItemRow {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  price: number;
  unit: string | null;
  lineTotal: number;
}

export interface OrderStatusHistoryRow {
  id: string;
  status: string;
  note: string | null;
  changedById: string;
  changedByName: string;
  at: string;
}

/**
 * How the GST on an order is arrived at. Mirrors `TAX_MODE_VALUES` in
 * packages/shared/src/enums.ts.
 *
 * Line prices are GST-EXCLUSIVE: the tax is added on top of the line sum,
 * never extracted from it. `None` is an explicit zero, not "unspecified".
 */
export const TAX_MODE_VALUES = ["None", "Percentage", "Amount"] as const;
export type TaxModeValue = (typeof TAX_MODE_VALUES)[number];

export const TAX_MODE_LABELS: Record<TaxModeValue, string> = {
  None: "No GST",
  Percentage: "GST by percentage",
  Amount: "GST by amount",
};

/** The short form, for a summary row or a printed invoice line. */
export const TAX_MODE_SHORT: Record<TaxModeValue, string> = {
  None: "No GST",
  Percentage: "GST",
  Amount: "GST (entered)",
};

export interface OrderRow {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  salespersonId: string;
  salespersonName: string;
  createdById: string | null;
  date: string;
  status: string;
  /** Sum of the line items, before GST. */
  subtotal: number;
  taxMode: TaxModeValue;
  /** The percentage charged, when taxMode is Percentage; null otherwise. */
  taxRate: number | null;
  taxAmount: number;
  /** subtotal + taxAmount. */
  total: number;
  isUrgent: boolean;
  paymentTerms: string | null;
  advanceAmount: number | null;
  advanceRef: string | null;
  deliveryMode: string | null;
  deliveryAddress: string | null;
  expectedDelivery: string | null;
  transporterName: string | null;
  lrNumber: string | null;
  deliveryInstructions: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  items: OrderItemRow[];
  statusHistory: OrderStatusHistoryRow[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderListResponse {
  items: OrderRow[];
  nextCursor: string | null;
  /** Rows matching the filter, ignoring the cursor window. */
  total: number;
}

export interface OrderCreate {
  code: string;
  customerId: string;
  salespersonId: string;
  items: OrderItemInput[];
  taxMode?: TaxModeValue;
  /** Percent, 0–100. Read only when taxMode is "Percentage". */
  taxRate?: number | null;
  /** Rupees. Read only when taxMode is "Amount". */
  taxAmount?: number | null;
  status?: string;
  date?: string;
  isUrgent?: boolean;
  paymentTerms?: string | null;
  advanceAmount?: number | null;
  advanceRef?: string | null;
  deliveryMode?: string | null;
  deliveryAddress?: string | null;
  expectedDelivery?: string | null;
  transporterName?: string | null;
  lrNumber?: string | null;
  deliveryInstructions?: string | null;
  /**
   * The recurring-projection line this order is raised from. The server links
   * the two in one transaction and refuses a second order for the same line,
   * which is what makes the worksheet's sales-order column real.
   */
  projectionId?: string;
}

export interface OrderUpdate {
  /**
   * Replaces the line items; the server recomputes the money from them and
   * accepts the change only while the order is still `Created`.
   */
  items?: OrderItemInput[];
  /** Changing any of these reprices the order from its current line items. */
  taxMode?: TaxModeValue;
  taxRate?: number | null;
  taxAmount?: number | null;
  /** The business issue date the invoice prints and the SLA clock starts from. */
  date?: string;
  status?: string;
  statusNote?: string | null;
  cancelReason?: string | null;
  isUrgent?: boolean;
  paymentTerms?: string | null;
  advanceAmount?: number | null;
  advanceRef?: string | null;
  deliveryMode?: string | null;
  deliveryAddress?: string | null;
  expectedDelivery?: string | null;
  transporterName?: string | null;
  lrNumber?: string | null;
  deliveryInstructions?: string | null;
}

/**
 * `status` and `deliveryMode` are raw DB enum strings on the wire (see
 * packages/shared/src/enums.ts — OrderStatusSchema / DeliveryModeSchema);
 * the API rejects anything else with a 400. The web shows friendly labels
 * in `<select>`s / status chips, so each `<option value>` / advance-button
 * value here is the raw value itself — there is no separate label→raw
 * translation step for a mismatch to hide behind. Mirrors the identical
 * bridge in features/customers/types.ts and features/payments/types.ts.
 *
 * `paymentTerms` on the order contract is a FREE STRING (`z.string()` in
 * OrderCreateSchema/OrderUpdateSchema — NOT an enum, unlike the customer
 * contract's PaymentTermsSchema), so it intentionally has no VALUES/LABELS
 * bridge here — it's rendered/edited as plain text.
 */
export const ORDER_STATUS_VALUES = [
  "Created",
  "Acknowledged",
  "DeliveryPartnerAssigned",
  "DeliveredFromWarehouse",
  "DeliveredToCustomer",
  "CustomerReceiptConfirmed",
  "Cancelled",
] as const;
export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number];
export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  Created: "Created",
  Acknowledged: "Acknowledged",
  DeliveryPartnerAssigned: "Delivery Partner Assigned",
  DeliveredFromWarehouse: "Delivered from Warehouse",
  DeliveredToCustomer: "Delivered to Customer",
  CustomerReceiptConfirmed: "Customer Receipt Confirmed",
  Cancelled: "Cancelled",
};

export const DELIVERY_MODE_VALUES = [
  "TransportLR",
  "Courier",
  "CompanyVehicle",
  "CustomerPickup",
  "HandDelivery",
] as const;
export type DeliveryModeValue = (typeof DELIVERY_MODE_VALUES)[number];
export const DELIVERY_MODE_LABELS: Record<DeliveryModeValue, string> = {
  TransportLR: "Transport (LR)",
  Courier: "Courier",
  CompanyVehicle: "Company Vehicle",
  CustomerPickup: "Customer Pickup",
  HandDelivery: "Hand Delivery",
};
