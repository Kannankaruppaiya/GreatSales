import { z } from "zod";
import { PaymentStatus, PayZone } from "./enums";

/** Payment / receivables contracts. */
export const PaymentFollowupSchema = z.object({
  id: z.string(),
  date: z.string(),
  note: z.string(),
  nextFollowupDate: z.string().nullable(),
});
export type PaymentFollowup = z.infer<typeof PaymentFollowupSchema>;

export const PaymentSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  invoiceNo: z.string(),
  amount: z.string(),
  dueDate: z.string().nullable(),
  agingDays: z.number().nullable(),
  payZone: PayZone.nullable(),
  status: PaymentStatus,
});
export type Payment = z.infer<typeof PaymentSchema>;

export const PaymentDetailSchema = PaymentSchema.extend({
  followups: z.array(PaymentFollowupSchema),
});
export type PaymentDetail = z.infer<typeof PaymentDetailSchema>;

export const CreatePaymentSchema = z.object({
  customerId: z.string().min(1),
  invoiceNo: z.string().min(1).max(60),
  amount: z.number().positive(),
  dueDate: z.string().datetime().optional(),
  payZone: PayZone.optional(),
});
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

export const UpdatePaymentSchema = z.object({
  status: PaymentStatus.optional(),
  payZone: PayZone.optional(),
  dueDate: z.string().datetime().optional(),
});
export type UpdatePaymentInput = z.infer<typeof UpdatePaymentSchema>;

/** Record a collection follow-up against an invoice. */
export const AddPaymentFollowupSchema = z.object({
  note: z.string().min(1).max(2000),
  nextFollowupDate: z.string().datetime().optional(),
});
export type AddPaymentFollowupInput = z.infer<typeof AddPaymentFollowupSchema>;
