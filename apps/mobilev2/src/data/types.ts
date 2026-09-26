/**
 * The row shapes the screens render.
 *
 * Each one is the API's own row from `@greatsales/shared`, renamed only where
 * the design's vocabulary differs (an order's `code` is its "SO number", a
 * payment row is an "invoice") and extended only with values derived from
 * fields the row already carries. Nothing here has a field the server does not
 * return or that cannot be computed from one it does — the previous version of
 * this file described a generated dataset, and several of its fields (a
 * four-value projection status, per-receipt payment records, a phone number on
 * the user) had no source in the real system at all.
 *
 * `ApiSource` is the only place these are built.
 */
import type {
  ContactRow,
  CustomerRow,
  DealStageValue,
  DeliveryModeValue,
  EntityTypeValue,
  LeadRow,
  NotificationType,
  OrderStatusValue,
  PayZoneValue,
  PaymentStatusValue,
  ProjStatusValue,
} from "@greatsales/shared";

export type Customer = CustomerRow;
export type Contact = ContactRow;
export type Lead = LeadRow;
export type { DealStageValue };

/** The signed-in salesperson, from `GET /auth/me`. */
export interface CurrentUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
  permissions: string[];
  mustChangePassword: boolean;
}

/**
 * A follow-up task. It points at one record by `entityType`/`entityId`;
 * `leadId` and `customerId` are that pointer unpacked for the two record types
 * the screens navigate to, and are null for every other type.
 */
export interface FollowUp {
  id: string;
  entityType: EntityTypeValue;
  entityId: string;
  leadId: string | null;
  customerId: string | null;
  /** What the task is about — resolved by the API from the record. */
  customerName: string;
  /** The task itself: the title typed when it was scheduled. */
  purpose: string;
  /** The second line typed with it, if any. */
  subtitle: string | null;
  notes: string | null;
  amount: number | null;
  /** `YYYY-MM-DD`. A follow-up is a day, not an instant. */
  dueAt: string;
  done: boolean;
  /**
   * When it was ticked off. The API keeps a `done` flag and an `updatedAt`, not
   * a completion time, so this is the last edit of a done task — the same
   * instant unless it was edited after being completed.
   */
  completedAt: string | null;
  createdAt: string;
}

export interface OrderLine {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unit: string | null;
  price: number;
  value: number;
}

export interface OrderStatusEvent {
  status: OrderStatusValue;
  at: string;
  note: string | null;
  byName: string | null;
}

export interface Order {
  id: string;
  /** The order code, e.g. `SO-2026-0001`. */
  soNumber: string;
  customerId: string;
  customerName: string;
  status: OrderStatusValue;
  lines: OrderLine[];
  subtotal: number;
  /** Whole percent — 18 means 18%. Null when tax was entered as an amount. */
  taxRate: number | null;
  tax: number;
  total: number;
  /** Free text on the order (the customer master's terms are an enum; this is not). */
  paymentTerms: string | null;
  isUrgent: boolean;
  issuedAt: string;
  expectedDeliveryAt: string | null;
  deliveryMode: DeliveryModeValue | null;
  deliveryAddress: string | null;
  transporterName: string | null;
  lrNumber: string | null;
  /** Delivery instructions typed when the order was raised. */
  notes: string | null;
  cancelReason: string | null;
  /** The recurring-projection line this order was raised from, if any. */
  projectionId: string | null;
  statusHistory: OrderStatusEvent[];
}

/** One collection follow-up logged against an invoice. */
export interface CollectionNote {
  id: string;
  date: string;
  note: string | null;
  nextFollowupDate: string | null;
}

/**
 * A receivable. The API calls these payments; each row is one invoice with
 * what has been received against it so far.
 */
export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string;
  invoiceDate: string | null;
  amount: number;
  received: number;
  pending: number;
  /** `YYYY-MM-DD`, from the invoice or the customer's credit terms. */
  dueAt: string | null;
  /** Days since the invoice was raised. */
  agingDays: number;
  /** Days past the due date; 0 when not yet due. */
  overdueDays: number;
  payZone: PayZoneValue | null;
  status: PaymentStatusValue;
  delayReason: string | null;
  nextFollowUp: string | null;
  collectionNotes: CollectionNote[];
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  principalId: string;
  principal: string;
  unit: string | null;
  /** Catalogue price. Null when the catalogue has none. */
  listPrice: number | null;
}

export interface Mapping {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  principalId: string;
  principal: string;
  /** Catalogue price. */
  listPrice: number | null;
  /** The price agreed with this customer, overriding the catalogue. */
  agreedPrice: number | null;
  /** What a projection line on this mapping is priced at. */
  effectivePrice: number | null;
  ownerId: string;
  ownerName: string;
  createdAt: string;
}

export interface Projection {
  id: string;
  /** `YYYY-MM`. */
  period: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  principalId: string;
  principal: string;
  projectedQty: number;
  price: number;
  projectedValue: number;
  achievedQty: number;
  achievedValue: number;
  /** Achieved as a percentage of projected; null when nothing was projected. */
  achievementPct: number | null;
  probability: number | null;
  status: ProjStatusValue;
  nextFollowUpAt: string | null;
  targetDate: string | null;
  remarkCount: number;
  /** The sales order raised from this line, once one has been. */
  salesOrderId: string | null;
  salesOrderStatus: string | null;
  /** A locked period is read-only: no edit, no delete, no roll-forward. */
  locked: boolean;
}

/**
 * One event on a record's timeline.
 *
 * The API has no event log, so a timeline is assembled from the records that
 * are events in their own right: a remark someone typed ("Note"), a follow-up
 * scheduled or completed on the record ("Follow-up"), and — for a lead — the
 * move into its current stage ("Stage change", from `stageUpdatedAt`). Each row
 * therefore traces back to one real record; none is inferred.
 *
 * `id` encodes where the row came from (see `activityId` in api-source), so
 * the detail screen can reload exactly this row.
 */
export interface Activity {
  id: string;
  entityType: EntityTypeValue;
  entityId: string;
  leadId: string | null;
  customerId: string | null;
  kind: "Note" | "Follow-up" | "Stage change";
  summary: string;
  /** Further detail: a follow-up's note, a remark has none. */
  detail: string | null;
  at: string;
  actorName: string | null;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  at: string;
  read: boolean;
  entityType: "Customer" | "Lead" | "Order" | "Payment" | null;
  entityId: string | null;
}
