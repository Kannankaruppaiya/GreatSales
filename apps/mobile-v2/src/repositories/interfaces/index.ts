import type {
  User,
  Customer,
  Lead,
  ProjectionLine,
  SalesOrder,
  Payment,
  FollowUp,
  Mapping,
  Activity,
  Notification,
  DashboardMetrics,
  DealStageValue,
  ProjStatusValue,
  OrderStatusValue,
  Product,
  Principal,
} from '../../domain/types';

export interface ProductRepository {
  list(): Promise<Product[]>;
  listPrincipals(): Promise<Principal[]>;
  getById(id: string): Promise<Product | null>;
}

export interface AuthRepository {
  login(email: string, password: string): Promise<{ user: User; token: string }>;
  logout(allSessions?: boolean): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  changePassword(oldPw: string, newPw: string): Promise<void>;
  updateProfile(input: { name?: string; phone?: string }): Promise<User>;
  updateAvatar(uri: string): Promise<string>;
  removeAvatar(): Promise<void>;
}

export interface DashboardRepository {
  getMetrics(ownerId?: string): Promise<DashboardMetrics>;
  getOralConfirmationDeals(ownerId?: string): Promise<Lead[]>;
  getTopProjections(ownerId?: string): Promise<ProjectionLine[]>;
  getPriorityFollowUps(ownerId?: string): Promise<FollowUp[]>;
  getPaymentAlerts(ownerId?: string): Promise<Payment[]>;
}

export interface CustomerRepository {
  list(params?: { search?: string; category?: string; area?: string; payZone?: string }): Promise<Customer[]>;
  getById(id: string): Promise<Customer | null>;
  create(input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer>;
  update(id: string, input: Partial<Customer>): Promise<Customer>;
  checkDuplicates(name: string, phone?: string): Promise<Customer[]>;
}

export interface LeadRepository {
  list(params?: { search?: string; stage?: string; salespersonId?: string }): Promise<Lead[]>;
  getById(id: string): Promise<Lead | null>;
  create(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'stageUpdatedAt'>): Promise<Lead>;
  update(id: string, input: Partial<Lead>): Promise<Lead>;
  changeStage(id: string, stage: DealStageValue, note?: string): Promise<Lead>;
  addRemark(id: string, note: string): Promise<void>;
}

export interface ProjectionRepository {
  list(params?: { search?: string; status?: string; principalId?: string }): Promise<ProjectionLine[]>;
  getById(id: string): Promise<ProjectionLine | null>;
  updateStatus(id: string, status: ProjStatusValue, note?: string): Promise<ProjectionLine>;
}

export interface OrderRepository {
  list(params?: { search?: string; status?: string }): Promise<SalesOrder[]>;
  getById(id: string): Promise<SalesOrder | null>;
  create(input: Omit<SalesOrder, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'statusHistory'>): Promise<SalesOrder>;
  advanceStatus(id: string, nextStatus: OrderStatusValue, note?: string): Promise<SalesOrder>;
  cancelOrder(id: string, reason: string): Promise<SalesOrder>;
}

export interface PaymentRepository {
  list(params?: { search?: string; status?: string; payZone?: string }): Promise<Payment[]>;
  getById(id: string): Promise<Payment | null>;
  recordPayment(id: string, amount: number, note?: string): Promise<Payment>;
  sendReminder(id: string, stage: 'mail1' | 'mail2' | 'mail3' | 'mail4'): Promise<Payment>;
  addRemark(id: string, note: string): Promise<void>;
}

export interface FollowUpRepository {
  list(params?: { filter?: 'all' | 'overdue' | 'today' | 'upcoming' | 'completed'; entityType?: string }): Promise<FollowUp[]>;
  getById(id: string): Promise<FollowUp | null>;
  create(input: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>): Promise<FollowUp>;
  complete(id: string, outcomeNote?: string): Promise<FollowUp>;
  snooze(id: string, days: number): Promise<FollowUp>;
}

export interface MappingRepository {
  list(params?: { search?: string; customerId?: string; principalId?: string }): Promise<Mapping[]>;
  getById(id: string): Promise<Mapping | null>;
  create(input: Omit<Mapping, 'id' | 'createdAt' | 'updatedAt'>): Promise<Mapping>;
  updatePrice(id: string, customPrice: number | null): Promise<Mapping>;
  delete(id: string): Promise<void>;
}

export interface NotificationRepository {
  list(): Promise<Notification[]>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
}

export interface ActivityRepository {
  listByCustomer(customerId: string): Promise<Activity[]>;
  listByEntity(entityType: string, entityId: string): Promise<Activity[]>;
  log(activity: Omit<Activity, 'id' | 'timestamp'>): Promise<Activity>;
}
