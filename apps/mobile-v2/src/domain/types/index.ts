/**
 * The app's domain types, which are the API's wire types.
 *
 * This file used to declare its own: 525 lines of interfaces written against
 * the in-memory fixtures, describing a Customer with `tier`, `industry`,
 * `paymentZone` and `primaryContactName` that the API has never sent. That is
 * the same failure as the four disagreeing colour palettes, in a place where
 * it costs more — a screen typed against a shape the server does not return
 * compiles perfectly and is wrong at runtime.
 *
 * packages/shared is the single definition. Its comment states the contract:
 * "The API validates inbound queries/bodies against these; the web infers its
 * request/response types from the same schemas so the wire format cannot
 * drift." Mobile now infers from them too, so there is one definition rather
 * than four, and a server-side change to a shape breaks this app's typecheck
 * instead of its screens.
 *
 * The aliases exist because shared names rows `XRow` (its callers deal in rows
 * and pages) while screens read better saying `Customer`. They are aliases,
 * not copies: there is nothing here to drift.
 */
export type {
  // Entities
  CustomerRow as Customer,
  LeadRow as Lead,
  PaymentRow as Payment,
  FollowUpRow as FollowUp,
  OrderRow as SalesOrder,
  MappingRow as Mapping,
  ProductRow as Product,
  PrincipalRow as Principal,
  NotificationRow as Notification,
  /**
   * The admin user-directory row. NOT the signed-in user: UserRow has no
   * `role` string and no permissions, which is what the old code read off it.
   */
  UserRow as User,
  /** The signed-in user: carries `role` and the server's resolved permissions. */
  AuthUser as SessionUser,
  PermissionKey,
  RoleRow as Role,
  ContactRow as Contact,
  IndustryRow as Industry,
  ProjectionLine,

  // Nested rows
  LeadProductRow as LeadProduct,
  OrderItemRow as OrderItem,
  OrderStatusHistoryRow as OrderStatusHistory,
  PaymentFollowupRow as PaymentFollowup,
  /** The API calls an activity a remark; the design calls it an activity. */
  RemarkRow as Activity,

  // Dashboard
  DashboardResponse,
  DashboardKpis,
  DashboardBreakdown,
  DashboardCategorySlice,
  DashboardFollowUp,

  // Enum value unions
  DealStageValue,
  ProjStatusValue,
  OrderStatusValue,
  PaymentStatusValue,
  PaymentTermsValue,
  PayZoneValue,
  CustomerCategoryValue,
  CustomerTypeValue,
  DivisionValue,
  DeliveryModeValue,
  EntityTypeValue,
  TaxModeValue,

  // Paging
  CursorPage,
  CursorPageQuery,
} from '@greatsales/shared';
