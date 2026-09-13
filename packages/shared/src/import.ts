import { z } from "zod";

/**
 * Bulk customer import.
 *
 * The Data page has always exported. Getting a customer master IN was typing,
 * which is why onboarding a workspace with four hundred accounts was a week of
 * somebody's life — and `ImportJob` has sat in the schema since the first
 * migration, unread and unwritten, describing the feature that would have
 * fixed it.
 *
 * The FILE is parsed in the browser and the ROWS are posted here. That split is
 * deliberate: the spreadsheet formats a workspace will actually hand over are
 * .xlsx as often as .csv, the web app already carries a reader for both, and
 * sending a binary to the API would mean a second parser on the server that has
 * to agree with the first about what a merged cell or a date column means.
 * What crosses the wire is rows, and rows are what the contract describes.
 *
 * A job is not all-or-nothing. Four hundred rows from a real spreadsheet will
 * contain a handful that are wrong, and refusing the whole file over them is
 * how an import feature stops being used: the good rows land, the bad ones come
 * back with their row number and the reason, and the person fixes those and
 * imports again. `ImportJob.errors` is that list, kept so the answer survives
 * the tab being closed.
 */

/** One row of a customer spreadsheet, after the browser has read it. */
export const ImportCustomerRowSchema = z.object({
  /**
   * The line this came from in the user's file, 1-based and counting the
   * header. Echoed back on failure, because "row 3 is invalid" is only useful
   * if row 3 means the same thing to the person looking at the spreadsheet.
   */
  line: z.number().int().min(1),
  name: z.string().trim().min(1).max(200),
  area: z.string().trim().max(120).nullish(),
  category: z.string().trim().max(40).nullish(),
  paymentTerms: z.string().trim().max(120).nullish(),
  contactName: z.string().trim().max(120).nullish(),
  phone: z.string().trim().max(40).nullish(),
  email: z.string().trim().max(200).nullish(),
  /** Matched by NAME against the workspace's users, not by id. */
  salespersonName: z.string().trim().max(200).nullish(),
});
export type ImportCustomerRow = z.infer<typeof ImportCustomerRowSchema>;

/**
 * How many rows one job may carry.
 *
 * A customer master is thousands of rows at the top end, and this is one HTTP
 * request holding one transaction. Five hundred keeps the request inside every
 * default body limit and the transaction inside a few seconds; a bigger file is
 * several jobs, which the page does for the user.
 */
export const IMPORT_MAX_ROWS = 500;

export const ImportCustomersSchema = z.object({
  rows: z.array(ImportCustomerRowSchema).min(1).max(IMPORT_MAX_ROWS),
  /**
   * What to do with a name that already exists in the workspace.
   *
   * "skip" leaves the existing account untouched and reports the row as
   * skipped. "update" fills in the columns the sheet carries and leaves the
   * rest alone. There is deliberately no "replace": a spreadsheet that omits a
   * column should never blank one.
   */
  onDuplicate: z.enum(["skip", "update"]).default("skip"),
});
export type ImportCustomers = z.infer<typeof ImportCustomersSchema>;

/**
 * Bulk receivables import.
 *
 * The Payments page has had an "Import Tally Excel" button since the feature
 * was built, and it posted the file one invoice at a time: a POST per row, in
 * a loop. A real Tally export is hundreds of invoices, the API throttles at 120
 * requests a minute, and the loop has no idea that is happening — so the import
 * ran until it was cut off, left the ledger half-written, reported the rest as
 * individual failures, and recorded nothing at all in the import history. The
 * customer import solved this the first time it was built; this is the same
 * shape, and it exists so the payments one stops being the exception.
 */
export const ImportPaymentRowSchema = z.object({
  /** 1-based line in the user's file, counting the header — echoed on failure. */
  line: z.number().int().min(1),
  /** The invoice reference. Blank is allowed; a duplicate of one already held is not. */
  refNo: z.string().trim().max(120).nullish(),
  /** Matched by NAME against the workspace's customers, as the export carries no ids. */
  customerName: z.string().trim().min(1).max(200),
  invoiceDate: z.string().trim().max(40).nullish(),
  amount: z.number().nonnegative(),
  received: z.number().nonnegative().nullish(),
  payZone: z.string().trim().max(40).nullish(),
  delayReason: z.string().trim().max(400).nullish(),
});
export type ImportPaymentRow = z.infer<typeof ImportPaymentRowSchema>;

export const ImportPaymentsSchema = z.object({
  rows: z.array(ImportPaymentRowSchema).min(1).max(IMPORT_MAX_ROWS),
  /**
   * What to do with a reference the ledger already holds.
   *
   * "skip" is the default and the safe one: a re-imported Tally export overlaps
   * the last one almost completely, and creating the overlap again is how a
   * receivables total doubles.
   */
  onDuplicate: z.enum(["skip", "update"]).default("skip"),
});
export type ImportPayments = z.infer<typeof ImportPaymentsSchema>;

/** One row that did not import, and why. */
export interface ImportRowError {
  line: number;
  name: string;
  reason: string;
}

export interface ImportJobRow {
  id: string;
  /** "customers" or "payments". */
  type: string;
  /** "completed" | "completed_with_errors" | "failed" */
  status: string;
  /** Rows in the file. */
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
  createdAt: string;
}

export const ImportJobListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
export type ImportJobListQuery = z.infer<typeof ImportJobListQuerySchema>;
