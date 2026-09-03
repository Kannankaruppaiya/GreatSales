import { z } from "zod";
import { OrderStatus } from "./enums";

/** Sales-order contracts. */
export const OrderItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  qty: z.string(),
  price: z.string(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderStatusEventSchema = z.object({
  id: z.string(),
  status: OrderStatus,
  at: z.string(),
});
export type OrderStatusEvent = z.infer<typeof OrderStatusEventSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  salespersonId: z.string(),
  date: z.string(),
  status: OrderStatus,
  total: z.string(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderDetailSchema = OrderSchema.extend({
  items: z.array(OrderItemSchema),
  statusHistory: z.array(OrderStatusEventSchema),
});
export type OrderDetail = z.infer<typeof OrderDetailSchema>;

export const CreateOrderSchema = z.object({
  customerId: z.string().min(1),
  salespersonId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().positive(),
        price: z.number().nonnegative(),
      }),
    )
    .min(1),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

/** Advance/override an order's status (records an OrderStatusHistory row). */
export const UpdateOrderStatusSchema = z.object({
  status: OrderStatus,
});
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
