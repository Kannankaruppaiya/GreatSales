import {
  syntheticAuthRepository,
  syntheticDashboardRepository,
  syntheticCustomerRepository,
  syntheticLeadRepository,
  syntheticProjectionRepository,
  syntheticOrderRepository,
  syntheticPaymentRepository,
  syntheticFollowUpRepository,
  syntheticMappingRepository,
  syntheticNotificationRepository,
  syntheticActivityRepository,
} from './synthetic';

import type {
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
 * Current Phase: Synthetic In-Memory Repositories (Fully reactive, zero hardcoded UI data).
 * Next Phase: Swap with ApiRepositories without touching screens, hooks, or components.
 */
export const authRepo: AuthRepository = syntheticAuthRepository;
export const dashboardRepo: DashboardRepository = syntheticDashboardRepository;
export const customerRepo: CustomerRepository = syntheticCustomerRepository;
export const leadRepo: LeadRepository = syntheticLeadRepository;
export const projectionRepo: ProjectionRepository = syntheticProjectionRepository;
export const orderRepo: OrderRepository = syntheticOrderRepository;
export const paymentRepo: PaymentRepository = syntheticPaymentRepository;
export const followUpRepo: FollowUpRepository = syntheticFollowUpRepository;
export const mappingRepo: MappingRepository = syntheticMappingRepository;
export const notificationRepo: NotificationRepository = syntheticNotificationRepository;
export const activityRepo: ActivityRepository = syntheticActivityRepository;
