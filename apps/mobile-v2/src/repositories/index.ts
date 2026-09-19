import type {
  ProductRepository,
  AuthRepository,
  DashboardRepository,
  CustomerRepository,
  LeadRepository,
  ProjectionRepository,
  OrderRepository,
  PaymentRepository,
  FollowUpRepository,
  MappingRepository,
  NotificationRepository,
  ActivityRepository,
} from './interfaces';

export * from './interfaces';

/**
 * GreatSales Repositories Registry.
 *
 * There is deliberately no implementation here yet.
 *
 * The previous version of this file wired all eleven repositories to
 * `./synthetic` — in-memory fixtures with a login that accepted the password
 * "1234" and handed back `demo_jwt_token_...`. Its own comment promised a
 * "Next Phase: Swap with ApiRepositories"; that phase never came, and the app
 * shipped thirty-seven screens that had never once talked to the API. Keeping a
 * fixture layer around "for now" is precisely how that happened, so there is no
 * fixture layer to fall back on: every accessor below throws until a real
 * `./api` implementation replaces it.
 *
 * During the design phase screens carry the literal content from the Penpot
 * mockup, so that a screenshot can be diffed against `export_shape` output.
 * They do not read from this registry. When a screen is wired, it moves to the
 * hooks in `src/hooks`, which read from here — and at that point a missing
 * implementation is a crash on first render, not a screen full of plausible
 * fake numbers that nobody notices.
 */
const pending = (name: string): never => {
  throw new Error(
    `${name} has no implementation. Add src/repositories/api/ and wire it in src/repositories/index.ts.`,
  );
};

/** Types the registry as the real interface while every call still throws. */
const notImplemented = <T extends object>(name: string): T =>
  new Proxy({} as T, { get: () => () => pending(name) });

export const productRepo = notImplemented<ProductRepository>('ProductRepository');
export const authRepo = notImplemented<AuthRepository>('AuthRepository');
export const dashboardRepo = notImplemented<DashboardRepository>('DashboardRepository');
export const customerRepo = notImplemented<CustomerRepository>('CustomerRepository');
export const leadRepo = notImplemented<LeadRepository>('LeadRepository');
export const projectionRepo = notImplemented<ProjectionRepository>('ProjectionRepository');
export const orderRepo = notImplemented<OrderRepository>('OrderRepository');
export const paymentRepo = notImplemented<PaymentRepository>('PaymentRepository');
export const followUpRepo = notImplemented<FollowUpRepository>('FollowUpRepository');
export const mappingRepo = notImplemented<MappingRepository>('MappingRepository');
export const notificationRepo = notImplemented<NotificationRepository>('NotificationRepository');
export const activityRepo = notImplemented<ActivityRepository>('ActivityRepository');
