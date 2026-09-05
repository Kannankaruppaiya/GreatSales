import { z } from "zod";
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
  cursor: z.string().optional(),
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

export interface PaymentListResponse {
  items: PaymentRow[];
  nextCursor: string | null;
}

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

// ============================================================
// BULK IMPORT (Tally / ERP weekly outstanding sheet)
// ============================================================
/**
 * Upper bound on rows accepted in one import call. A weekly outstanding sheet
 * is comfortably within this; the cap keeps a single request (and the one
 * transaction it runs in) bounded, and rejects a pathological upload before any
 * work starts. The client parses the sheet only to PREVIEW it — the server
 * re-validates and re-dedupes every row here, so the browser is never the
 * integrity boundary.
 */
export const PAYMENT_IMPORT_MAX_ROWS = 5000;

/**
 * One row of an import request. `rowNumber` is the 1-based source-sheet row, so
 * the per-row result the server returns points back at the exact line the user
 * sees. `invoiceNo` is deliberately absent: the sheet's reference is `refNo`
 * (the dedupe key), and Payment's non-partial `@@unique([tenantId, invoiceNo])`
 * would abort a whole import on a repeat rather than skip it. `refNo` is
 * optional — a row without a reference can never be a duplicate of another and
 * always inserts.
 */
export const PaymentImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  amount: z.number().nonnegative(),
  refNo: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  received: z.number().nonnegative().optional(),
  payZone: PayZoneSchema.nullable().optional(),
  delayReason: z.string().nullable().optional(),
});
export type PaymentImportRow = z.infer<typeof PaymentImportRowSchema>;

/** POST /payments/import body — the parsed, previewed rows the user confirmed. */
export const PaymentImportSchema = z.object({
  rows: z.array(PaymentImportRowSchema).min(1).max(PAYMENT_IMPORT_MAX_ROWS),
});
export type PaymentImport = z.infer<typeof PaymentImportSchema>;

/**
 * Outcome of one source row. FLAGGED-SKIP policy: a repeat reference (already
 * live in the ledger, or repeated earlier in the same sheet) is `skipped_duplicate`
 * and reported — it is not an error and does not roll the import back. `error`
 * is reserved for a row the server could not persist; because the whole import
 * is one transaction, any `error` means nothing at all was committed.
 */
export interface PaymentImportRowResult {
  rowNumber: number;
  refNo: string | null;
  status: "created" | "skipped_duplicate" | "error";
  message?: string;
  paymentId?: string;
}

export interface PaymentImportResult {
  /** The ImportJob audit row recorded for this attempt (survives a rollback). */
  importJobId: string;
  totalRows: number;
  created: number;
  skippedDuplicates: number;
  failed: number;
  results: PaymentImportRowResult[];
}
