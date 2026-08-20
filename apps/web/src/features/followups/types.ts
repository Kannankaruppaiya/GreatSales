/**
 * Wire types for the follow-ups API. These mirror the `@greatsales/shared`
 * FollowUpRow / FollowUpListResponse contracts; kept as a local copy so the
 * Vite build does not need to consume the CJS `shared` dist. The API is the
 * source of truth — keep this in sync with packages/shared/src/followup.ts.
 *
 * NOTE: the FollowUp table has NO soft-delete column — `DELETE /followups/:id`
 * is a hard delete (see queries.ts `useDeleteFollowUp`).
 */

/**
 * `entityType` is a raw DB enum string on the wire (see
 * packages/shared/src/enums.ts — EntityTypeSchema); the API rejects anything
 * else with a 400. The raw values already read as friendly labels, so any
 * `<select>` built from ENTITY_TYPE_VALUES can use the value directly as its
 * own display text — there is no separate label→raw translation step for a
 * mismatch to hide behind.
 */
export const ENTITY_TYPE_VALUES = ["Customer", "Lead", "Order", "Payment", "Projection"] as const;
export type EntityTypeValue = (typeof ENTITY_TYPE_VALUES)[number];

export interface FollowUpRow {
  id: string;
  entityType: EntityTypeValue;
  entityId: string;
  salespersonId: string;
  salespersonName: string;
  title: string | null;
  subtitle: string | null;
  amount: number | null;
  dueDate: string;
  done: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpListResponse {
  items: FollowUpRow[];
  nextCursor: string | null;
}

export interface FollowUpCreate {
  entityType: EntityTypeValue;
  entityId: string;
  dueDate: string;
  salespersonId?: string | null;
  title?: string | null;
  subtitle?: string | null;
  amount?: number | null;
  note?: string | null;
  done?: boolean;
}

export interface FollowUpUpdate {
  entityType?: EntityTypeValue;
  entityId?: string;
  dueDate?: string;
  title?: string | null;
  subtitle?: string | null;
  amount?: number | null;
  note?: string | null;
  done?: boolean;
}
