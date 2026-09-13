import { z } from "zod";
import { CursorSchema, type CursorPage } from "./pagination";
import {
  DeliveryModeSchema,
  OrderStatusSchema,
  TaxModeSchema,
  type DeliveryModeValue,
  type OrderStatusValue,
  type TaxModeValue,
} from "./enums";

/**
 * Sales-order contracts, shared by the API and web. An order carries line items
 * and a status-history trail.
 *
 * `subtotal`, `taxAmount` and `total` are all derived server-side from the line
 * items and the tax mode — see the order-engine. A client sends the INPUTS
 * (items, taxMode, and whichever of taxRate/taxAmount the mode needs) and never
 * a total; whatever it shows before saving is a preview of the same arithmetic.
 * `total` is the GRAND total, tax included, and is the figure every list,
 * invoice and export prints.
 *
 * Money/qty are plain numbers on the wire (Prisma Decimal → number in the
 * service).
 */

/**
 * The GST fields, shared by create and update so the two cannot drift.
 *
 * Ranges only. Which field a mode REQUIRES is checked in the order-engine
 * (`validateTaxSpec`), because a PATCH may change the rate without restating
 * the mode — the effective mode is only known once the stored order is read,
 * so a zod refinement here could only ever guess at it.
 */
const TaxInputShape = {
  taxMode: TaxModeSchema.optional(),
  /** Percent, 0–100, at most two decimals. Used when taxMode is Percentage. */
  taxRate: z.number().min(0).max(100).nullable().optional(),
  /** Rupees. Used when taxMode is Amount; ignored in the other two modes. */
  taxAmount: z.number().nonnegative().nullable().optional(),
};

export const OrderItemInputSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().nonnegative(),
  price: z.number().nonnegative(),
  unit: z.string().nullable().optional(),
});
export type OrderItemInput = z.infer<typeof OrderItemInputSchema>;

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
  status: OrderStatusValue;
  note: string | null;
  changedById: string;
  changedByName: string;
  at: string;
}

/** GET /orders query. `ownerId` omitted (or "ALL") = no salesperson filter. */
export const OrderListQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: OrderStatusSchema.optional(),
  customerId: z.string().optional(),
  ownerId: z.string().optional(),
  /** Orders carrying at least one item whose product belongs to this principal. */
  principalId: z.string().optional(),
});
export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;

export interface OrderRow {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  salespersonId: string;
  salespersonName: string;
  createdById: string | null;
  date: string;
  status: OrderStatusValue;
  /** Sum of the line items, before GST. */
  subtotal: number;
  taxMode: TaxModeValue;
  /** The percentage charged, when taxMode is Percentage; null otherwise. */
  taxRate: number | null;
  taxAmount: number;
  /** subtotal + taxAmount. The order's value, GST included. */
  total: number;
  isUrgent: boolean;
  paymentTerms: string | null;
  advanceAmount: number | null;
  advanceRef: string | null;
  deliveryMode: DeliveryModeValue | null;
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

export type OrderListResponse = CursorPage<OrderRow>;

/**
 * POST /orders body. Every money figure on the order is computed server-side
 * from `items` and the tax fields; none of them is accepted from here.
 */
export const OrderCreateSchema = z.object({
  code: z.string().min(1).max(60),
  customerId: z.string().min(1),
  salespersonId: z.string().min(1),
  items: z.array(OrderItemInputSchema).min(1),
  ...TaxInputShape,
  status: OrderStatusSchema.optional(),
  date: z.string().optional(),
  isUrgent: z.boolean().optional(),
  paymentTerms: z.string().nullable().optional(),
  advanceAmount: z.number().nonnegative().nullable().optional(),
  advanceRef: z.string().nullable().optional(),
  deliveryMode: DeliveryModeSchema.nullable().optional(),
  deliveryAddress: z.string().nullable().optional(),
  expectedDelivery: z.string().nullable().optional(),
  transporterName: z.string().nullable().optional(),
  lrNumber: z.string().nullable().optional(),
  deliveryInstructions: z.string().nullable().optional(),
  /**
   * The recurring-projection line this order is being raised from.
   *
   * `Projection.salesOrderId` exists in the schema and was never written by
   * anything: the worksheet could set a line to "Order Placed" but the status
   * was a label somebody typed, with no order behind it and no way to reach
   * one. Passing the line here links the two in the same transaction, which is
   * what lets the worksheet show the order's real status and refuse to delete a
   * line that has become an order.
   */
  projectionId: z.string().optional(),
});
export type OrderCreate = z.infer<typeof OrderCreateSchema>;

/**
 * PATCH /orders/:id — scalar edits and/or a status transition. Passing `status`
 * appends a status-history entry (with optional `statusNote`); moving to
 * Cancelled records `cancelReason` and stamps `cancelledAt`. At least one field.
 */
export const OrderUpdateSchema = z
  .object({
    /**
     * Replaces the line items, and `total` is recomputed from them — accepted
     * only while the order is still `Created`, because an order the warehouse
     * has already acknowledged is a commitment rather than a draft.
     *
     * Without this the only way to correct a mistyped quantity or a
     * renegotiated price was to delete the order and raise it again, losing
     * its number, its status trail, its remarks and its attachments with it.
     */
    items: z.array(OrderItemInputSchema).min(1).optional(),
    /**
     * The GST on the order. Changing any of these re-derives subtotal, tax and
     * total from the order's CURRENT line items, so correcting a rate does not
     * require restating the lines.
     */
    ...TaxInputShape,
    /** The business issue date, which the printed invoice and the SLA clock both use. */
    date: z.string().optional(),
    status: OrderStatusSchema.optional(),
    statusNote: z.string().nullable().optional(),
    cancelReason: z.string().nullable().optional(),
    isUrgent: z.boolean().optional(),
    paymentTerms: z.string().nullable().optional(),
    advanceAmount: z.number().nonnegative().nullable().optional(),
    advanceRef: z.string().nullable().optional(),
    deliveryMode: DeliveryModeSchema.nullable().optional(),
    deliveryAddress: z.string().nullable().optional(),
    expectedDelivery: z.string().nullable().optional(),
    transporterName: z.string().nullable().optional(),
    lrNumber: z.string().nullable().optional(),
    deliveryInstructions: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field must be provided",
  });
export type OrderUpdate = z.infer<typeof OrderUpdateSchema>;
