/**
 * Wire types for the products (catalog) API. These mirror the
 * `@greatsales/shared` ProductRow / ProductListResponse contracts; kept as a
 * local copy so the Vite build does not need to consume the CJS `shared`
 * dist. The API is the source of truth — keep this in sync with
 * packages/shared/src/product.ts.
 */

export type DivisionValue = "LUB" | "WES";

export interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  division: DivisionValue | null;
  unit: string | null;
  basePrice: number | null;
  active: boolean;
  principalId: string;
  principalName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  items: ProductRow[];
  nextCursor: string | null;
  /** Rows matching the filter, ignoring the cursor window. */
  total: number;
}

export interface ProductCreate {
  name: string;
  principalId: string;
  sku?: string | null;
  division?: DivisionValue | null;
  unit?: string | null;
  basePrice?: number | null;
  active?: boolean;
}

export type ProductUpdate = Partial<ProductCreate>;

// =============================================================================
// Principal Types
// =============================================================================

export interface PrincipalRow {
  id: string;
  name: string;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PrincipalListResponse {
  items: PrincipalRow[];
}

export interface PrincipalCreate {
  name: string;
}

export type PrincipalUpdate = Partial<PrincipalCreate>;

