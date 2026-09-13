import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 15, // 15 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const QUERY_KEYS = {
  currentUser: ['currentUser'] as const,
  dashboard: (ownerId?: string) => ['dashboard', ownerId || 'self'] as const,
  oralDeals: (ownerId?: string) => ['dashboard', 'oralDeals', ownerId || 'self'] as const,
  topProjections: (ownerId?: string) => ['dashboard', 'topProjections', ownerId || 'self'] as const,
  priorityFollowUps: (ownerId?: string) => ['dashboard', 'priorityFollowUps', ownerId || 'self'] as const,
  paymentAlerts: (ownerId?: string) => ['dashboard', 'paymentAlerts', ownerId || 'self'] as const,

  customers: (params?: any) => ['customers', params] as const,
  customer: (id: string) => ['customer', id] as const,
  customerActivity: (customerId: string) => ['customerActivity', customerId] as const,

  leads: (params?: any) => ['leads', params] as const,
  lead: (id: string) => ['lead', id] as const,

  projections: (params?: any) => ['projections', params] as const,
  projection: (id: string) => ['projection', id] as const,

  orders: (params?: any) => ['orders', params] as const,
  order: (id: string) => ['order', id] as const,

  payments: (params?: any) => ['payments', params] as const,
  payment: (id: string) => ['payment', id] as const,

  followups: (params?: any) => ['followups', params] as const,
  followup: (id: string) => ['followup', id] as const,

  mappings: (params?: any) => ['mappings', params] as const,
  mapping: (id: string) => ['mapping', id] as const,

  notifications: ['notifications'] as const,
  activities: (entityType: string, entityId: string) => ['activities', entityType, entityId] as const,
};

export type WriteTarget =
  | 'customers'
  | 'leads'
  | 'orders'
  | 'payments'
  | 'projections'
  | 'mappings'
  | 'followups'
  | 'profile'
  | 'dashboard';

export const STALE_AFTER: Record<WriteTarget, readonly string[]> = {
  customers: ['customers', 'customer', 'mappings', 'projections', 'orders', 'payments', 'dashboard'],
  leads: ['leads', 'lead', 'dashboard'],
  orders: ['orders', 'order', 'projections', 'dashboard', 'customer'],
  payments: ['payments', 'payment', 'customers', 'customer', 'dashboard'],
  projections: ['projections', 'projection', 'dashboard'],
  mappings: ['mappings', 'mapping', 'projections', 'dashboard', 'customer'],
  followups: ['followups', 'followup', 'dashboard', 'projections'],
  profile: ['currentUser', 'dashboard'],
  dashboard: ['dashboard', 'currentUser'],
};

export function invalidateEntity(target: WriteTarget) {
  const families = STALE_AFTER[target] || [target];
  for (const family of families) {
    queryClient.invalidateQueries({ queryKey: [family] });
  }
}
