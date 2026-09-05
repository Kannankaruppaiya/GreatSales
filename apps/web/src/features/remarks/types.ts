/**
 * Wire types for the remarks API. These mirror the `@greatsales/shared`
 * RemarkRow / RemarkCreate contracts; kept as a local copy so the Vite build
 * does not need to consume the CJS `shared` dist. The API is the source of
 * truth — keep this in sync with packages/shared/src/remark.ts.
 */

/** The five entities the API accepts a note on. */
export type RemarkEntityType =
  | "Projection"
  | "Lead"
  | "Payment"
  | "Order"
  | "Customer";

export interface RemarkRow {
  id: string;
  entityType: RemarkEntityType;
  entityId: string;
  userId: string | null;
  userName: string | null;
  text: string;
  at: string;
}

export interface RemarkCreate {
  entityType: RemarkEntityType;
  entityId: string;
  text: string;
}

export interface RemarkListResponse {
  items: RemarkRow[];
  nextCursor: string | null;
  total: number;
}
