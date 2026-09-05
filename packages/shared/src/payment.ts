import { z } from "zod";
import { CursorSchema, type CursorPage } from "./pagination";
import {
  PaymentStatusSchema,
  PayZoneSchema,
  type PaymentStatusValue,
  type PayZoneValue,
} from "./enums";

/**
 * Payment (receivables) contracts, shared by the API and web. A payment need
 * not link to a customer record (manual entries carry a free-text
 * `customerName`). `pending`/`status`/`agingDays` are derived server-side from
 * amount/received/dueDate — see the payment-engine.
 */

export interface PaymentFollowupRow {
  id: string;
  date: string;
  note: string;
  nextFollowupDate: string | null;
}

/** GET /payments query. `ownerId` omitted (or "ALL") = no salesperson filter. */
export const PaymentListQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: PaymentStatusSchema.optional(),
  customerId: z.string().optional(),
  ownerId: z.string().optional(),
});
export type PaymentListQuery = z.infer<typeof PaymentListQuerySchema>;

export interface PaymentRow {
  id: string;
  refNo: string | null;
  customerId: string | null;
  customerName: string | null;
  salespersonId: string | null;
  salespersonName: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  amount: number;
  received: number;
  pending: number;
  dueDate: string | null;
  agingDays: number | null;
  payZone: PayZoneValue | null;
  delayReason: string | null;
  nextFollowUp: string | null;
  mail1: boolean;
  mail2: boolean;
  mail3: boolean;
  mail4: boolean;
  status: PaymentStatusValue;
  followups: PaymentFollowupRow[];
  createdAt: string;
  updatedAt: string;
}

export type PaymentListResponse = CursorPage<PaymentRow>;

/** POST /payments body. Only `amount` is required (manual payments allowed). */
export const PaymentCreateSchema = z.object({
  amount: z.number().nonnegative(),
  refNo: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  salespersonId: z.string().nullable().optional(),
  invoiceNo: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  received: z.number().nonnegative().optional(),
  dueDate: z.string().nullable().optional(),
  payZone: PayZoneSchema.nullable().optional(),
  delayReason: z.string().nullable().optional(),
  nextFollowUp: z.string().nullable().optional(),
  mail1: z.boolean().optional(),
  mail2: z.boolean().optional(),
  mail3: z.boolean().optional(),
  mail4: z.boolean().optional(),
});
export type PaymentCreate = z.infer<typeof PaymentCreateSchema>;

/** PATCH /payments/:id — partial edit. At least one field required. */
export const PaymentUpdateSchema = PaymentCreateSchema.partial().refine(
  (o) => Object.keys(o).length > 0,
  { message: "At least one field must be provided" },
);
export type PaymentUpdate = z.infer<typeof PaymentUpdateSchema>;
