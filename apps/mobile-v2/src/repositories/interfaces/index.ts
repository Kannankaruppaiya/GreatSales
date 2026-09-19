import type {
  CursorPage,
  SessionUser,
  Customer,
  Lead,
  ProjectionLine,
  SalesOrder,
  Payment,
  FollowUp,
  Mapping,
  Activity,
  Notification,
  Product,
  Principal,
  DashboardResponse,
  DealStageValue,
  ProjStatusValue,
  OrderStatusValue,
  EntityTypeValue,
} from '../../domain/types';
import type {
  CustomerCreate,
  CustomerUpdate,
  LeadCreate,
  LeadUpdate,
  OrderCreate,
  FollowUpCreate,
  MappingCreate,
  ReminderStage,
} from '@greatsales/shared';

/**
 * What the app can ask for, expressed in the API's own contract.
 *
 * Two things changed when these stopped describing in-memory fixtures.
 *
 * Every list is a PAGE, not an array. The API's list endpoints are cursor
 * paginated (CursorPageQuerySchema: limit 1-100, default 20) and return
 * { items, nextCursor, total }. The previous `list(): Promise<Customer[]>`
 * could only have been honoured by either dropping everything past the first
 * page or walking every page on mount — one silently wrong, the other a
 * request storm against a tenant with 100k customers. A screen that wants one
 * page asks for one; a list that scrolls passes the cursor it was handed.
 *
 * Writes take the API's own body types (CustomerCreate, LeadUpdate, ...) rather
 * than Partial<Entity>. A row carries fields the server computes — outstanding,
 * salespersonName, updatedAt — and Partial<Row> invites a screen to send them,
 * which the endpoint's zod schema rejects at runtime with a 400 that the
 * typecheck was happy about.
 */

/** Common paging argument. Omit `cursor` for the first page. */
export interface PageParams {
  cursor?: string;
  limit?: number;
}

export interface ProductRepository {
  list(params?: PageParams & { search?: string }): Promise<CursorPage<Product>>;
  listPrincipals(params?: PageParams): Promise<CursorPage<Principal>>;
  getById(id: string): Promise<Product | null>;
}

export interface AuthRepository {
  /**
   * Returns the session user, which the API models as AuthUser - it carries
   * `role` and the server's RESOLVED permission keys. The app had been reading
   * a `role` off UserRow, which has none.
   *
   * `client: "mobile"` is sent by the implementation and is not optional: the
   * API admits only `sales` from mobile (AGENTS.md, CLIENT_ROLE_ALLOWLIST) and
   * refuses anything else with a 403 after the password verifies.
   */
  login(email: string, password: string): Promise<{ user: SessionUser; token: string }>;
  logout(allSessions?: boolean): Promise<void>;
  getCurrentUser(): Promise<SessionUser | null>;
  changePassword(oldPw: string, newPw: string): Promise<void>;
}

export interface DashboardRepository {
  /**
   * One request, not five. GET /dashboard is an aggregate that already carries
   * the KPIs, the oral-confirmation deals, the top projections and the
   * follow-up rows; the old interface's five getters would have fired five
   * copies of the same query on every mount of the home screen.
   *
   * `from`/`to` are resolved by the caller from a granularity and an anchor
   * (packages/shared resolveRange), never stored as a range - see AGENTS.md.
   */
  overview(params: { from: string; to: string; ownerId?: string }): Promise<DashboardResponse>;
}

export interface CustomerRepository {
  list(params?: PageParams & {
    search?: string;
    category?: string;
    area?: string;
    payZone?: string;
    industryId?: string;
    principalId?: string;
    ownerId?: string;
  }): Promise<CursorPage<Customer>>;
  getById(id: string): Promise<Customer | null>;
  create(input: CustomerCreate): Promise<Customer>;
  update(id: string, input: CustomerUpdate): Promise<Customer>;
  /** Server-side name/phone match, so it sees accounts this user cannot list. */
  checkDuplicates(name: string, phone?: string): Promise<Customer[]>;
}

export interface LeadRepository {
  list(params?: PageParams & {
    search?: string;
    stage?: string;
    salespersonId?: string;
  }): Promise<CursorPage<Lead>>;
  getById(id: string): Promise<Lead | null>;
  create(input: LeadCreate): Promise<Lead>;
  update(id: string, input: LeadUpdate): Promise<Lead>;
  changeStage(id: string, stage: DealStageValue, note?: string): Promise<Lead>;
  addRemark(id: string, note: string): Promise<void>;
}

export interface ProjectionRepository {
  list(params?: PageParams & {
    search?: string;
    status?: string;
    principalId?: string;
  }): Promise<CursorPage<ProjectionLine>>;
  getById(id: string): Promise<ProjectionLine | null>;
  updateStatus(id: string, status: ProjStatusValue, note?: string): Promise<ProjectionLine>;
}

export interface OrderRepository {
  list(params?: PageParams & { search?: string; status?: string }): Promise<CursorPage<SalesOrder>>;
  getById(id: string): Promise<SalesOrder | null>;
  create(input: OrderCreate): Promise<SalesOrder>;
  advanceStatus(id: string, nextStatus: OrderStatusValue, note?: string): Promise<SalesOrder>;
  cancelOrder(id: string, reason: string): Promise<SalesOrder>;
}

export interface PaymentRepository {
  list(params?: PageParams & {
    search?: string;
    status?: string;
    payZone?: string;
  }): Promise<CursorPage<Payment>>;
  getById(id: string): Promise<Payment | null>;
  recordPayment(id: string, amount: number, note?: string): Promise<Payment>;
  sendReminder(id: string, stage: ReminderStage): Promise<Payment>;
  addRemark(id: string, note: string): Promise<void>;
}

export interface FollowUpRepository {
  list(params?: PageParams & {
    filter?: 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';
    entityType?: EntityTypeValue;
  }): Promise<CursorPage<FollowUp>>;
  getById(id: string): Promise<FollowUp | null>;
  create(input: FollowUpCreate): Promise<FollowUp>;
  complete(id: string, outcomeNote?: string): Promise<FollowUp>;
  snooze(id: string, days: number): Promise<FollowUp>;
}

export interface MappingRepository {
  list(params?: PageParams & {
    search?: string;
    customerId?: string;
    principalId?: string;
  }): Promise<CursorPage<Mapping>>;
  getById(id: string): Promise<Mapping | null>;
  create(input: MappingCreate): Promise<Mapping>;
  updatePrice(id: string, customPrice: number | null): Promise<Mapping>;
  delete(id: string): Promise<void>;
}

export interface NotificationRepository {
  list(params?: PageParams): Promise<CursorPage<Notification>>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
}

export interface ActivityRepository {
  /** Remarks for one record. `entityType` is the API's enum, not a free string. */
  listByEntity(entityType: EntityTypeValue, entityId: string, params?: PageParams): Promise<CursorPage<Activity>>;
  log(input: { entityType: EntityTypeValue; entityId: string; text: string }): Promise<Activity>;
}
