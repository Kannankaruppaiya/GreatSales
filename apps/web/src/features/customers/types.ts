/**
 * Wire types for the customers API. These mirror the `@greatsales/shared`
 * CustomerRow / CustomerListResponse contracts; kept as a local copy so the
 * Vite build does not need to consume the CJS `shared` dist. The API is the
 * source of truth — keep this in sync with packages/shared/src/customer.ts.
 */

export type DivisionValue = "LUB" | "WES";

export interface CustomerRow {
  id: string;
  name: string;
  division: DivisionValue | null;
  category: string | null;
  type: string | null;
  industryId: string | null;
  industryName: string | null;
  subIndustry: string | null;
  area: string | null;
  paymentTerms: string | null;
  payZone: string | null;
  outstanding: number;
  active: boolean;
  salespersonId: string;
  salespersonName: string;
  collectorId: string | null;
  collectorName: string | null;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  items: CustomerRow[];
  nextCursor: string | null;
}

export interface CustomerCreate {
  name: string;
  salespersonId: string;
  division?: string | null;
  category?: string | null;
  type?: string | null;
  industryId?: string | null;
  subIndustry?: string | null;
  area?: string | null;
  paymentTerms?: string | null;
  payZone?: string | null;
  outstanding?: number;
  collectorId?: string | null;
  active?: boolean;
}

export type CustomerUpdate = Partial<CustomerCreate>;
