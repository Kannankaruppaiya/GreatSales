/**
 * The one seam between the screens and the API.
 *
 * Screens never call `fetch`. They take the `DataSource` from context and call
 * these methods; `ApiSource` is the implementation.
 *
 * Read and write are separate interfaces on purpose. The payments module has
 * no write methods at all, because a salesperson holds `payment.read` and not
 * `payment.write` (ROLE_PERMISSIONS in @greatsales/shared). Making that a
 * property of the interface means a payment-writing screen cannot be built by
 * accident — there is nothing to call. The API refuses it regardless.
 */
import type {
  CustomerCategoryValue,
  DealStageValue,
  EntityTypeValue,
  OrderStatusValue,
  PaymentTermsValue,
  ProjStatusValue,
} from "@greatsales/shared";

import type {
  Activity,
  AppNotification,
  CurrentUser,
  Customer,
  FollowUp,
  Invoice,
  Lead,
  Mapping,
  Order,
  Product,
  Projection,
} from "./types";

export type * from "./types";

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
  category?: CustomerCategoryValue;
  area?: string;
  industryId?: string;
  /** Accounts carrying a non-zero balance. */
  withOutstanding?: boolean;
}

export interface LeadQuery extends ListQuery {
  stage?: DealStageValue;
  stages?: DealStageValue[];
  /** Expected closure on or before this `YYYY-MM-DD`. */
  closeBefore?: string;
  /** Open stages only — the pipeline's default view. */
  openOnly?: boolean;
  /** `value` is a top-N list: it returns no next cursor. */
  sort?: "value" | "closeDate" | "recent";
}

/** `open` is every task not yet done, whatever its date. */
export type FollowUpBucket =
  | "open"
  /** Open and due from today through the next six days. */
  | "week"
  | "overdue"
  | "today"
  | "upcoming"
  | "completed";

export interface FollowUpQuery extends ListQuery {
  bucket?: FollowUpBucket;
  /** Due date order. Soonest first is the default — it is the working order. */
  sort?: "soonest" | "latest";
  customerId?: string;
  leadId?: string;
  /** Any one record's follow-ups — an invoice's, an order's, a projection line's. */
  entity?: EntityRef;
}

export interface OrderQuery extends ListQuery {
  status?: string;
  customerId?: string;
}

export interface ProjectionQuery {
  /** `YYYY-MM`. Defaults to the current month. */
  period?: string;
  customerId?: string;
  search?: string;
  status?: ProjStatusValue;
  needsFollowUp?: boolean;
}

export interface MappingQuery extends ListQuery {
  customerId?: string;
  productId?: string;
  principalId?: string;
  /** Mappings with no price at all — neither agreed nor in the catalogue. */
  unpricedOnly?: boolean;
}

export interface InvoiceQuery extends ListQuery {
  customerId?: string;
  overdueOnly?: boolean;
}

/** Home screen roll-up. Every figure is computed by the API or from its rows. */
export interface HomeSummary {
  followUpsDue: number;
  /** Today's open follow-ups whose title names a visit. */
  siteVisits: number;
  proposals: number;
  overdueFollowUps: number;
  openOpportunities: number;
  openOpportunityValue: number;
  outstandingTotal: number;
  overdueTotal: number;
}

/**
 * One month's commitment against achievement, from `GET /dashboard` — the same
 * figures the web dashboard shows for this salesperson, computed once on the
 * server. Recurring is the projections worksheet; new sales is the pipeline
 * (committed = raised in the month, achieved = won in it).
 */
export interface SalesProgress {
  period: string;
  recurringCommitted: number;
  recurringAchieved: number;
  newSalesCommitted: number;
  newSalesAchieved: number;
  totalCommitted: number;
  totalAchieved: number;
  /** Null when no target is set for the month — not the same as zero. */
  target: number | null;
}

/** Collections roll-up, from `GET /payments/summary`. Read-only by design. */
export interface PaymentsSummary {
  totalPending: number;
  overdue: number;
  overdueCount: number;
  over90Days: number;
  openCount: number;
  aging: { bucket: string; amount: number; count: number }[];
}

export interface StageCount {
  stage: DealStageValue;
  count: number;
  value: number;
}

export interface Named {
  id: string;
  name: string;
}

/** A record an activity belongs to. */
export interface EntityRef {
  entityType: EntityTypeValue;
  entityId: string;
}

/** The read surface. Everything a screen needs to render. */
export interface DataSource {
  getCurrentUser(): Promise<CurrentUser>;

  getHomeSummary(): Promise<HomeSummary>;
  /** `period` is `YYYY-MM`. */
  getSalesProgress(period: string): Promise<SalesProgress>;

  listCustomers(query?: CustomerQuery): Promise<Page<Customer>>;
  getCustomer(id: string): Promise<Customer | null>;
  /** Every account the salesperson owns — for the locations screen, which
   * has to split the whole book into pinned and not. */
  listAllCustomers(search?: string): Promise<Customer[]>;
  listIndustries(): Promise<Named[]>;

  listLeads(query?: LeadQuery): Promise<Page<Lead>>;
  getLead(id: string): Promise<Lead | null>;
  /** Count and value per stage — every stage, open and closed. */
  getPipelineStageCounts(): Promise<StageCount[]>;

  listFollowUps(query?: FollowUpQuery): Promise<Page<FollowUp>>;
  getFollowUp(id: string): Promise<FollowUp | null>;

  listOrders(query?: OrderQuery): Promise<Page<Order>>;
  getOrder(id: string): Promise<Order | null>;

  listProducts(
    query?: ListQuery & { principalId?: string },
  ): Promise<Page<Product>>;
  listPrincipals(): Promise<Named[]>;

  listMappings(query?: MappingQuery): Promise<Page<Mapping>>;
  getMapping(id: string): Promise<Mapping | null>;

  /** One month's worksheet, filtered. Not paged: a month is one salesperson's lines. */
  listProjections(query?: ProjectionQuery): Promise<Projection[]>;
  getProjection(id: string): Promise<Projection | null>;
  /**
   * The months the worksheet can show, newest first, each flagged locked or
   * open: the last twelve months and the next one.
   */
  listProjectionPeriods(): Promise<{ period: string; locked: boolean }[]>;

  /** Collections. Read-only — there is no corresponding write method. */
  getPaymentsSummary(): Promise<PaymentsSummary>;
  listInvoices(query?: InvoiceQuery): Promise<Page<Invoice>>;
  /**
   * Every invoice with money still owed, for the screens that group the
   * whole ledger by customer or by age. One salesperson's ledger.
   */
  listOpenInvoices(search?: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | null>;

  /** A record's timeline, newest first. */
  listActivities(entity: EntityRef): Promise<Activity[]>;
  getActivity(id: string): Promise<Activity | null>;

  listNotifications(): Promise<{ items: AppNotification[]; unread: number }>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
}

export interface CustomerInput {
  name: string;
  area?: string | null;
  industryId?: string | null;
  category?: CustomerCategoryValue | null;
  paymentTerms?: PaymentTermsValue | null;
  contactName?: string | null;
  designation?: string | null;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyM?: number | null;
}

export interface LeadProductInput {
  productId: string | null;
  productName: string;
  principalId: string | null;
  qty: number | null;
  unit: string | null;
  price: number | null;
}

export interface LeadInput {
  customerName: string;
  stage?: DealStageValue;
  /** Copied from the customer the lead is raised against. */
  tier?: CustomerCategoryValue | null;
  industryId?: string | null;
  contacts?: {
    name: string;
    designation: string | null;
    phone: string | null;
    whatsapp: string | null;
    sameAsMobile: boolean;
    email: string | null;
    isPrimary: boolean;
  }[];
  area?: string | null;
  address?: string | null;
  /** `YYYY-MM-DD`. */
  expClose?: string | null;
  /**
   * `YYYY-MM-DD`. The API keeps this as the lead's own follow-up task, so it
   * appears on the Follow-ups list without a second record being created.
   */
  nextFollowUp?: string | null;
  products?: LeadProductInput[];
}

export interface FollowUpInput {
  entityType: EntityTypeValue;
  entityId: string;
  /** What is to be done — "Site visit", "Send quotation". */
  purpose: string;
  notes?: string | null;
  /** `YYYY-MM-DD`. */
  dueDate: string;
}

export interface OrderInput {
  customerId: string;
  lines: {
    productId: string;
    qty: number;
    price: number;
    unit?: string | null;
  }[];
  expectedDeliveryAt?: string | null;
  deliveryAddress?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  isUrgent?: boolean;
  /** Whole percent. */
  taxRate?: number;
  /** The projection line this order is raised from; linked in one transaction. */
  projectionId?: string | null;
}

export interface ProjectionPatch {
  price?: number | null;
  projectedQty?: number;
  achievedQty?: number;
  status?: ProjStatusValue;
  probability?: number | null;
  nextFollowUpAt?: string | null;
  targetDate?: string | null;
}

/** The write surface. Note what is absent: every payment write. */
export interface MutableDataSource extends DataSource {
  createCustomer(input: CustomerInput): Promise<Customer>;
  updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;

  createLead(input: LeadInput): Promise<Lead>;
  updateLead(id: string, input: Partial<LeadInput>): Promise<Lead>;
  changeLeadStage(id: string, stage: DealStageValue): Promise<Lead>;
  deleteLead(id: string): Promise<void>;

  createFollowUp(input: FollowUpInput): Promise<FollowUp>;
  completeFollowUp(id: string, notes?: string): Promise<FollowUp>;
  deleteFollowUp(id: string): Promise<void>;
  /**
   * Attach what the salesperson typed to a follow-up the API created for them
   * (a lead's own next-follow-up task).
   */
  annotateFollowUp(id: string, notes: string): Promise<FollowUp>;

  createOrder(input: OrderInput): Promise<Order>;
  /**
   * Move an order one rung along the fulfilment ladder. The API refuses any
   * other move — skipping a rung, or reviving a cancelled order.
   */
  setOrderStatus(
    id: string,
    status: OrderStatusValue,
    note?: string | null,
  ): Promise<Order>;
  cancelOrder(id: string, reason: string): Promise<Order>;
  deleteOrder(id: string): Promise<void>;

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

  updateProjection(id: string, input: ProjectionPatch): Promise<Projection>;
  deleteProjection(id: string): Promise<void>;
  /** Open `period` by carrying the previous month's live lines into it. */
  rollForwardProjections(period: string): Promise<{ created: number }>;

  addRemark(entity: EntityRef, text: string): Promise<Activity>;
}

/** Narrowing helper kept for screens written against the read surface. */
export function isMutable(source: DataSource): source is MutableDataSource {
  return typeof (source as MutableDataSource).createLead === "function";
}
