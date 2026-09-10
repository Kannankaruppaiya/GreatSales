import { z } from "zod";
import { EntityTypeSchema } from "./enums";

/**
 * Files attached to a record.
 *
 * The table has existed since the first migration — `s3Key`, `fileName`,
 * `size`, `uploadedById` — and nothing ever wrote one, so a purchase order, a
 * signed quotation or a photo of a damaged delivery lived in somebody's email
 * and the CRM row said nothing about it.
 *
 * Attached to the same five entities remarks are, and for the same reason: an
 * attachment is a note you cannot type.
 */

/**
 * What may be uploaded.
 *
 * An allow-list, not a block-list. The files this product needs are documents
 * and photographs, and every "block the dangerous ones" list is a list of the
 * dangerous ones somebody thought of. Anything not here is refused by name so
 * the user knows what to convert it to.
 */
export const ALLOWED_ATTACHMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "text/csv": "csv",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

/**
 * 10 MB.
 *
 * A scanned purchase order is comfortably under it and a phone photo is around
 * a fifth of it. The cap is enforced on the server rather than only by the
 * upload widget, because the widget is not what a request has to get past.
 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const AttachmentListQuerySchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().min(1),
});
export type AttachmentListQuery = z.infer<typeof AttachmentListQuerySchema>;

/** The metadata that travels with a multipart upload. */
export const AttachmentUploadSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().min(1),
});
export type AttachmentUpload = z.infer<typeof AttachmentUploadSchema>;

export interface AttachmentRow {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
  /** Bytes. */
  size: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

/**
 * Where the bytes are: `GET /attachments/:id/download`, through the API and
 * never a bucket URL.
 *
 * A pre-signed link would be shorter, and it would also be a URL that grants a
 * business document to whoever holds it with no reference to who is asking.
 * The download route re-checks the caller against the parent record on every
 * request, which is the same rule the list obeys.
 *
 * Built by the client from the id rather than sent as a field on the row. A
 * client that fetches whatever URL a response hands it is a habit worth not
 * having, and a path that exists only as a string the server built is a path
 * no static check can see anyone calling.
 */
export function attachmentDownloadPath(id: string): string {
  return `/attachments/${id}/download`;
}
