import {
  SYNTHETIC_USERS,
  SYNTHETIC_CUSTOMERS,
  SYNTHETIC_PRODUCTS,
  SYNTHETIC_PRINCIPALS,
  SYNTHETIC_LEADS,
  SYNTHETIC_PROJECTIONS,
  SYNTHETIC_ORDERS,
  SYNTHETIC_PAYMENTS,
  SYNTHETIC_FOLLOWUPS,
  SYNTHETIC_MAPPINGS,
  SYNTHETIC_ACTIVITIES,
  SYNTHETIC_NOTIFICATIONS,
} from '../../data/synthetic';

import type {
  User,
  Customer,
  Product,
  Principal,
  Lead,
  ProjectionLine,
  SalesOrder,
  Payment,
  FollowUp,
  Mapping,
  Activity,
  Notification,
} from '../../domain/types';

/**
 * Canonical in-memory state store for GreatSales mobile-v2.
 * Single source of truth during development & offline synthetic testing.
 */
class CanonicalState {
  users: User[] = [...SYNTHETIC_USERS];
  currentUser: User = SYNTHETIC_USERS[0]; // Megala by default
  customers: Customer[] = [...SYNTHETIC_CUSTOMERS];
  products: Product[] = [...SYNTHETIC_PRODUCTS];
  principals: Principal[] = [...SYNTHETIC_PRINCIPALS];
  leads: Lead[] = [...SYNTHETIC_LEADS];
  projections: ProjectionLine[] = [...SYNTHETIC_PROJECTIONS];
  orders: SalesOrder[] = [...SYNTHETIC_ORDERS];
  payments: Payment[] = [...SYNTHETIC_PAYMENTS];
  followups: FollowUp[] = [...SYNTHETIC_FOLLOWUPS];
  mappings: Mapping[] = [...SYNTHETIC_MAPPINGS];
  activities: Activity[] = [...SYNTHETIC_ACTIVITIES];
  notifications: Notification[] = [...SYNTHETIC_NOTIFICATIONS];

  reset() {
    this.users = [...SYNTHETIC_USERS];
    this.currentUser = SYNTHETIC_USERS[0];
    this.customers = [...SYNTHETIC_CUSTOMERS];
    this.products = [...SYNTHETIC_PRODUCTS];
    this.principals = [...SYNTHETIC_PRINCIPALS];
    this.leads = [...SYNTHETIC_LEADS];
    this.projections = [...SYNTHETIC_PROJECTIONS];
    this.orders = [...SYNTHETIC_ORDERS];
    this.payments = [...SYNTHETIC_PAYMENTS];
    this.followups = [...SYNTHETIC_FOLLOWUPS];
    this.mappings = [...SYNTHETIC_MAPPINGS];
    this.activities = [...SYNTHETIC_ACTIVITIES];
    this.notifications = [...SYNTHETIC_NOTIFICATIONS];
  }
}

export const canonicalState = new CanonicalState();
