import { z } from "zod";
import { CursorSchema, type CursorPage } from "./pagination";
import {
  PaymentStatusSchema,
  PayZoneSchema,
  type PaymentStatusValue,
  type PaymentTermsValue,
  type PayZoneValue,
} from "./enums";

/**
 * How long a customer has to pay, by the terms agreed with them.
 *
 * The Tally import used to add a flat 30 days to every invoice date, which was
 * wrong in both directions at once: a customer paying cash on delivery was
 * given a month they never had, and a Credit45 customer was marked overdue a
 * fortnight early. The terms were sitting on the customer record the whole
 * time — the same import even parses "Credit 45" out of a spreadsheet — and
 * nothing read them.
 *
 * The four zero-day terms are zero for different reasons and it does not
 * matter here: cash on delivery, payment up front, half up front and "due
 * immediately" all mean the invoice is payable the day it is raised.
 */
export const CREDIT_DAYS: Record<PaymentTermsValue, number> = {
  Immediate: 0,
  Credit15: 15,
  Credit30: 30,
  Credit45: 45,
  CashOnDelivery: 0,
  Advance50Balance: 0,
  AdvancePayment: 0,
};

/**
 * What a customer with no terms recorded is assumed to have.
 *
 * 30 days, which is what the import hardcoded for everybody — so a customer
 * whose terms nobody has filled in behaves exactly as it did before, and the
 * only rows this changes are the ones where a real answer was available and
 * being ignored.
 */
export const DEFAULT_CREDIT_DAYS = 30;

export function creditDays(
  terms: PaymentTermsValue | null | undefined,
): number {
  return terms == null ? DEFAULT_CREDIT_DAYS : CREDIT_DAYS[terms];
}

/**
 * Payment (receivables) contracts, shared by the API and web. A payment need
 * not link to a customer record (manual entries carry a free-text
 * `customerName`). `pending`/`status`/`agingDays` are derived server-side from
 * amount/received/dueDate — see the payment-engine.
 */

/**
 * The reminder letters, in the order a collector sends them. The chase is a
 * sequence, not four independent switches: the third letter after the first is
 * a mistake, not an escalation, so both clients offer only the next unsent one.
 */
export const REMINDER_STAGES = ["mail1", "mail2", "mail3", "mail4"] as const;
export type ReminderStage = (typeof REMINDER_STAGES)[number];

/** "1st", "2nd", "3rd", "4th" — for labelling a stage to a person. */
export const REMINDER_ORDINALS = ["1st", "2nd", "3rd", "4th"] as const;

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
  /**
   * How old the INVOICE is: whole days since it was raised, null without an
   * invoice date.
   *
   * This used to count from the due date, which made the number on a row
   * disagree with the date printed beside it — an invoice dated 22 Oct 2024
   * read "664d" on a day 694 days later, because 30 days of credit had been
   * quietly subtracted. Aging is the age of the receivable; how far past its
   * due date it has gone is `overdueDays`, which is a different question and
   * now has its own answer.
   */
  agingDays: number | null;
  /** Whole days past the due date; 0 when not yet due, null with no due date. */
  overdueDays: number | null;
  payZone: PayZoneValue | null;
  delayReason: string | null;
  nextFollowUp: string | null;
  /** The four reminder letters, in the order they are sent. */
  mail1: boolean;
  mail2: boolean;
  mail3: boolean;
  mail4: boolean;
  /**
   * When each letter went out, ISO-8601, or null. Read-only: the API stamps it
   * when the flag beside it flips, so a client never sends one. Null on a flag
   * that is true means the letter predates the column — sent on a date nobody
   * recorded, which is not the same as not sent.
   */
  mail1At: string | null;
  mail2At: string | null;
  mail3At: string | null;
  mail4At: string | null;
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

/**
 * GET /payments/summary — the caller's receivables, rolled up.
 *
 * Every figure is derived from the same `PaymentRow` values the list shows
 * (`pending`, `overdueDays`, `agingDays`), so the summary and the rows it sits
 * above cannot disagree.
 */
export interface PaymentSummary {
  /** Sum of `pending` over every open invoice. */
  totalPending: number;
  /** Pending on invoices past their due date. */
  overdue: number;
  overdueCount: number;
  /** Pending on invoices more than 90 days old. */
  over90Days: number;
  openCount: number;
  /** Pending by invoice age. Buckets are fixed and always all present. */
  aging: {
    bucket: "0-30" | "31-60" | "61-90" | "90+";
    amount: number;
    count: number;
  }[];
}
