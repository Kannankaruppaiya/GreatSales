/**
 * Wire types for the payments API. These mirror the `@greatsales/shared`
 * PaymentRow / PaymentListResponse contracts; kept as a local copy so the
 * Vite build does not need to consume the CJS `shared` dist. The API is the
 * source of truth — keep this in sync with packages/shared/src/payment.ts.
 *
 * `pending`, `status`, and `agingDays` are computed server-side (from
 * amount/received and today's date vs. dueDate) — they are never part of
 * PaymentCreate/PaymentUpdate and must be rendered exactly as received, never
 * recomputed client-side. `followups` is likewise a read-only nested list
 * (the FollowUps API — see features/followups — is the write path for that
 * entity; this task does not wire a create-followup-from-payment flow).
 */

export interface PaymentFollowupRow {
  id: string;
  date: string;
  note: string;
  nextFollowupDate: string | null;
}

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
  payZone: string | null;
  delayReason: string | null;
  nextFollowUp: string | null;
  mail1: boolean;
  mail2: boolean;
  mail3: boolean;
  mail4: boolean;
  status: string;
  followups: PaymentFollowupRow[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentListResponse {
  items: PaymentRow[];
  nextCursor: string | null;
}

export interface PaymentCreate {
  amount: number;
  refNo?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  salespersonId?: string | null;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  received?: number;
  dueDate?: string | null;
  payZone?: string | null;
  delayReason?: string | null;
  nextFollowUp?: string | null;
  mail1?: boolean;
  mail2?: boolean;
  mail3?: boolean;
  mail4?: boolean;
}

export type PaymentUpdate = Partial<PaymentCreate>;

/**
 * Bulk-import wire types. Mirrors @greatsales/shared PaymentImport* — the API
 * is the source of truth. The browser parses the spreadsheet only to PREVIEW
 * it; these rows are re-validated and re-deduped server-side, so the client is
 * never the integrity boundary. `rowNumber` is the 1-based source-sheet row so
 * the server's per-row result points back at the exact line the user sees.
 */
export const PAYMENT_IMPORT_MAX_ROWS = 5000;

export interface PaymentImportRow {
  rowNumber: number;
  amount: number;
  refNo?: string | null;
  customerName?: string | null;
  invoiceDate?: string | null;
  received?: number;
  payZone?: PayZoneValue | null;
  delayReason?: string | null;
}

export interface PaymentImport {
  rows: PaymentImportRow[];
}

export interface PaymentImportRowResult {
  rowNumber: number;
  refNo: string | null;
  status: "created" | "skipped_duplicate" | "error";
  message?: string;
  paymentId?: string;
}

export interface PaymentImportResult {
  importJobId: string;
  totalRows: number;
  created: number;
  skippedDuplicates: number;
  failed: number;
  results: PaymentImportRowResult[];
}

/**
 * `payZone` is a raw DB enum string on the wire (see
 * packages/shared/src/enums.ts — PayZoneSchema); the API rejects anything
 * else with a 400. The web shows friendly labels in `<select>`s / filter
 * chips, so each `<option value>` / chip value here is the raw value itself
 * — there is no separate label→raw translation step for a mismatch to hide
 * behind. Mirrors the identical bridge in features/customers/types.ts.
 */
export const PAY_ZONE_VALUES = ["RedZone", "YellowZone", "GreenZone", "Blacklist"] as const;
export type PayZoneValue = (typeof PAY_ZONE_VALUES)[number];
export const PAY_ZONE_LABELS: Record<PayZoneValue, string> = {
  RedZone: "Red Zone",
  YellowZone: "Yellow Zone",
  GreenZone: "Green Zone",
  Blacklist: "Blacklist",
};

/**
 * `status` is server-computed and never appears in PaymentCreate/
 * PaymentUpdate (see the file doc comment above) — this bridge exists only
 * for the list-filter chips, which send the raw value as a `?status=` query
 * param (see PaymentStatusSchema in packages/shared/src/enums.ts).
 */
export const PAYMENT_STATUS_VALUES = ["Pending", "PartiallyPaid", "Paid", "Overdue"] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUS_VALUES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatusValue, string> = {
  Pending: "Pending",
  PartiallyPaid: "Partially Paid",
  Paid: "Paid",
  Overdue: "Overdue",
};
