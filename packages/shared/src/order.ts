import { z } from "zod";
import { CursorSchema, type CursorPage } from "./pagination";
import {
  DeliveryModeSchema,
  OrderStatusSchema,
  type DeliveryModeValue,
  type OrderStatusValue,
} from "./enums";

/**
 * Sales-order contracts, shared by the API and web. An order carries line items
 * and a status-history trail. `total` is derived from the items (never trusted
 * from the client) — see the order-engine. Money/qty are plain numbers on the
 * wire (Prisma Decimal → number in the service).
 */

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

/** POST /orders body. `total` is computed server-side from `items`. */
export const OrderCreateSchema = z.object({
  code: z.string().min(1).max(60),
  customerId: z.string().min(1),
  salespersonId: z.string().min(1),
  items: z.array(OrderItemInputSchema).min(1),
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
