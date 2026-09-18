/**
 * The one seam between the screens and where data comes from.
 *
 * Screens never call `fetch` and never import the synthetic generators. They
 * take a `DataSource` from context and call these methods, so pointing the app
 * at the real API is a one-line change in `config.ts` — no screen is touched.
 *
 * Read and write are separated deliberately. `DataSource` is the read surface
 * every screen gets; the write surface is narrower, and the payments module has
 * no write surface at all, because a salesperson holds `payment.read` and not
 * `payment.write` (see ROLE_PERMISSIONS in @greatsales/shared). Making that a
 * property of the interface means a payment-writing screen cannot be built by
 * accident — there is nothing to call.
 */
import type { CustomerRow, DealStageValue, LeadRow } from "@greatsales/shared";

import type {
  SyntheticActivity,
  SyntheticFollowUp,
  SyntheticInvoice,
  SyntheticMapping,
  SyntheticNotification,
  SyntheticOrder,
  SyntheticPaymentRecord,
  SyntheticProduct,
  SyntheticProjection,
  SyntheticUser,
} from "./synthetic/dataset";

/**
 * Row shapes the API does not yet return in this form.
 *
 * Customers, leads and contacts already have contracts in `@greatsales/shared`
 * and are used directly. The aliases below name the shapes this app needs for
 * screens whose server contract is either different or not yet settled; they
 * are declared here rather than in the synthetic folder so that an API-backed
 * source can satisfy the same interface without importing anything synthetic.
 */
export type Customer = CustomerRow;
export type Lead = LeadRow;
export type FollowUp = SyntheticFollowUp;
export type Order = SyntheticOrder;
export type Invoice = SyntheticInvoice;
export type PaymentRecord = SyntheticPaymentRecord;
export type Product = SyntheticProduct;
export type Mapping = SyntheticMapping;
export type Projection = SyntheticProjection;
export type Activity = SyntheticActivity;
export type AppNotification = SyntheticNotification;
export type CurrentUser = SyntheticUser;

export interface Page<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

export interface ListQuery {
  search?: string;
  cursor?: string | null;
  limit?: number;
}

export interface CustomerQuery extends ListQuery {
  category?: string;
  area?: string;
  industry?: string;
  /** Accounts carrying a non-zero balance. */
  withOutstanding?: boolean;
}

export interface LeadQuery extends ListQuery {
  stage?: DealStageValue;
  /**
   * Several stages at once, from the filter sheet. `stage` stays for the
   * single-stage rail, which the API can serve directly; `stages` is narrowed
   * on the client, because `/leads` takes one stage only.
   */
  stages?: DealStageValue[];
  /** Expected closure on or before this ISO date. */
  closeBefore?: string;
  /** Open stages only — the pipeline's default view. */
  openOnly?: boolean;
  sort?: "value" | "closeDate" | "probability" | "recent";
}

export type FollowUpBucket = "overdue" | "today" | "upcoming" | "completed";

export interface FollowUpQuery extends ListQuery {
  bucket?: FollowUpBucket;
  customerId?: string;
  leadId?: string;
}

export interface OrderQuery extends ListQuery {
  status?: string;
  customerId?: string;
}

export interface ProjectionQuery extends ListQuery {
  /** `YYYY-MM`. Defaults to the current month. */
  period?: string;
  customerId?: string;
  status?: string;
  needsFollowUp?: boolean;
}

export interface MappingQuery extends ListQuery {
  customerId?: string;
  productId?: string;
  principal?: string;
  /** Mappings with no agreed price set. */
  unpricedOnly?: boolean;
}

/** Home screen roll-up. Every figure is derived, never stored. */
export interface HomeSummary {
  followUpsDue: number;
  siteVisits: number;
  proposals: number;
  overdueFollowUps: number;
  openOpportunities: number;
  openOpportunityValue: number;
  outstandingTotal: number;
  overdueTotal: number;
}

/** Collections roll-up. Read-only for a salesperson, by design. */
export interface PaymentsSummary {
  totalPending: number;
  totalOutstanding: number;
  overdue: number;
  over90Days: number;
  followUpCount: number;
  aging: { bucket: string; amount: number; count: number }[];
}

/**
 * The read surface. Everything a screen needs to render.
 */
export interface DataSource {
  /** Which source this is, for the dev banner and for tests. */
  readonly kind: "synthetic" | "api";

  getCurrentUser(): Promise<CurrentUser>;

  getHomeSummary(): Promise<HomeSummary>;

  listCustomers(query?: CustomerQuery): Promise<Page<Customer>>;
  getCustomer(id: string): Promise<Customer | null>;

  listLeads(query?: LeadQuery): Promise<Page<Lead>>;
  getLead(id: string): Promise<Lead | null>;
  /**
   * Count and value per pipeline stage.
   *
   * Open stages only by default, which is what the stage rail and the pipeline
   * header need. `openOnly: false` returns the closed stages too, for the
   * All Stages screen, which shows the funnel whole.
   */
  getPipelineStageCounts(options?: {
    openOnly?: boolean;
  }): Promise<{ stage: DealStageValue; count: number; value: number }[]>;

  listFollowUps(query?: FollowUpQuery): Promise<Page<FollowUp>>;
  getFollowUp(id: string): Promise<FollowUp | null>;

  listOrders(query?: OrderQuery): Promise<Page<Order>>;
  getOrder(id: string): Promise<Order | null>;

  listProducts(query?: ListQuery): Promise<Page<Product>>;

  listMappings(query?: MappingQuery): Promise<Page<Mapping>>;
  getMapping(id: string): Promise<Mapping | null>;

  listProjections(query?: ProjectionQuery): Promise<Page<Projection>>;
  getProjection(id: string): Promise<Projection | null>;
  /** Periods the app may show, newest first, each flagged locked or open. */
  listProjectionPeriods(): Promise<{ period: string; locked: boolean }[]>;

  /** Collections. Read-only — there is no corresponding write method. */
  getPaymentsSummary(): Promise<PaymentsSummary>;
  listInvoices(
    query?: ListQuery & { customerId?: string; overdueOnly?: boolean },
  ): Promise<Page<Invoice>>;
  getInvoice(id: string): Promise<Invoice | null>;
  listPaymentRecords(
    query?: ListQuery & { customerId?: string; invoiceId?: string },
  ): Promise<Page<PaymentRecord>>;

  listActivities(
    query?: ListQuery & { leadId?: string; customerId?: string; kind?: string },
  ): Promise<Page<Activity>>;
  getActivity(id: string): Promise<Activity | null>;

  listNotifications(query?: ListQuery): Promise<Page<AppNotification>>;
  markNotificationRead(id: string): Promise<void>;
}

/**
 * The write surface, for the flows that create records.
 *
 * Kept separate from `DataSource` so that a read-only screen can be handed a
 * source it cannot write through. Note what is absent: no payment create,
 * update, delete, import or reminder-send. That is not an oversight — the sales
 * role has `payment.read` only, so those operations would be rejected by the
 * API and must not be offered in the UI.
 */
export interface MutableDataSource extends DataSource {
  createCustomer(
    input: Partial<Customer> & { name: string },
  ): Promise<Customer>;
  updateCustomer(id: string, input: Partial<Customer>): Promise<Customer>;

  createLead(input: Partial<Lead> & { customerName: string }): Promise<Lead>;
  updateLead(id: string, input: Partial<Lead>): Promise<Lead>;
  changeLeadStage(id: string, stage: DealStageValue): Promise<Lead>;

  createFollowUp(
    input: Omit<FollowUp, "id" | "createdAt" | "completedAt">,
  ): Promise<FollowUp>;
  completeFollowUp(id: string, notes?: string): Promise<FollowUp>;

  createOrder(input: {
    customerId: string;
    lines: { productId: string; qty: number; price: number }[];
    expectedDeliveryAt?: string | null;
    deliveryAddress?: string | null;
    paymentTerms?: Order["paymentTerms"];
  }): Promise<Order>;

  createMapping(input: {
    customerId: string;
    productId: string;
    agreedPrice: number | null;
  }): Promise<Mapping>;
  updateMapping(
    id: string,
    input: { agreedPrice: number | null },
  ): Promise<Mapping>;
  deleteMapping(id: string): Promise<void>;

  updateProjection(id: string, input: Partial<Projection>): Promise<Projection>;
  deleteProjection(id: string): Promise<void>;
}

/** Narrowing helper for screens that need to write. */
export function isMutable(source: DataSource): source is MutableDataSource {
  return typeof (source as MutableDataSource).createLead === "function";
}
