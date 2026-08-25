/**
 * Wire types for the customer x product mappings API. These mirror the
 * `@greatsales/shared` Mapping contracts; kept as a local copy so the Vite
 * build does not need to consume the CJS `shared` dist — the same arrangement
 * every other feature here uses. The API is the source of truth: keep this in
 * sync with packages/shared/src/mapping.ts.
 *
 * (That duplication is a known drift risk, tracked as F.2 in
 * checklists/06-SHARED-PACKAGES.md. Following the existing pattern rather than
 * inventing a second one here.)
 */

export interface MappingRow {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  productSku: string | null;
  principalId: string;
  principalName: string;
  salespersonId: string;
  salespersonName: string;
  /** Catalog price, shown so the override has something to depart from. */
  basePrice: number | null;
  /** The agreed override, or null when the catalog price applies. */
  customPrice: number | null;
  /** `customPrice ?? basePrice`, resolved by the SERVER. Never recompute it here. */
  effectivePrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MappingListResponse {
  items: MappingRow[];
  nextCursor: string | null;
}

export interface MappingCreate {
  customerId: string;
  productId: string;
  /** Honoured only for admin/management; a sales user is bound to themselves. */
  salespersonId?: string;
  customPrice?: number | null;
}

export interface MappingUpdate {
  salespersonId?: string;
  customPrice?: number | null;
}
