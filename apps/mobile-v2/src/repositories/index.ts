import {
  apiAuthRepository,
  apiDashboardRepository,
  apiCustomerRepository,
  apiLeadRepository,
  apiOrderRepository,
  apiPaymentRepository,
  apiFollowUpRepository,
  apiMappingRepository,
  apiProjectionRepository,
  apiNotificationRepository,
  apiActivityRepository,
  apiProductRepository,
} from './api';

export * from './interfaces';

/**
 * GreatSales Repositories Registry.
 *
 * Every repository talks to the real API. There is no fixture implementation
 * to fall back to and no flag that selects one: the previous version of this
 * file wired all eleven to in-memory synthetic data behind a comment promising
 * a "Next Phase: Swap with ApiRepositories" that never came, and thirty-seven
 * screens shipped against it without one request ever leaving the app.
 *
 * A repository that cannot answer now fails the way the API failed - a 401, a
 * 403, a 404, an ApiError carrying the server's code - which is a thing a
 * screen can show and a person can act on. That is the point of having no
 * second source of truth here.
 */
export const authRepo = apiAuthRepository;
export const dashboardRepo = apiDashboardRepository;
export const customerRepo = apiCustomerRepository;
export const leadRepo = apiLeadRepository;
export const projectionRepo = apiProjectionRepository;
export const orderRepo = apiOrderRepository;
export const paymentRepo = apiPaymentRepository;
export const followUpRepo = apiFollowUpRepository;
export const mappingRepo = apiMappingRepository;
export const notificationRepo = apiNotificationRepository;
export const activityRepo = apiActivityRepository;
export const productRepo = apiProductRepository;
