import type {
  CustomerListResponse,
  CustomerRow,
  LeadListResponse,
  LeadRow,
  OrderListResponse,
  OrderRow,
  PaymentListResponse,
  PaymentRow,
  FollowUpListResponse,
  FollowUpRow,
  MappingListResponse,
  MappingRow,
  ProjectionListResponse,
  ProjectionLine,
  PrincipalRow,
  NotificationListResponse,
  ProductListResponse,
  RemarkRow,
  CursorPage,
} from '@greatsales/shared';
import { apiFetch, buildQuery } from '../../lib/api';
import type {
  CustomerRepository,
  LeadRepository,
  OrderRepository,
  PaymentRepository,
  FollowUpRepository,
  MappingRepository,
  NotificationRepository,
  ActivityRepository,
  ProductRepository,
  ProjectionRepository,
} from '../interfaces';

/**
 * The record repositories: thin, honest wrappers over the endpoints.
 *
 * Nothing here computes, merges or caches. Anything that looks like business
 * logic in a repository is logic the server already owns and the client is
 * about to disagree with - which is exactly how the synthetic layer came to
 * report a tenant's totals from twenty rows.
 *
 * `buildQuery` drops undefined and empty params, so an unset filter is an
 * absent query key rather than `?search=undefined`.
 */

export const apiCustomerRepository: CustomerRepository = {
  list: (p = {}) => apiFetch<CustomerListResponse>(`/customers${buildQuery(p)}`),
  getById: (id) => apiFetch<CustomerRow>(`/customers/${id}`),
  create: (input) =>
    apiFetch<CustomerRow>('/customers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id, input) =>
    apiFetch<CustomerRow>(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  /**
   * Asks the server, rather than filtering a page the client happens to hold.
   * A duplicate check that only sees this salesperson's first twenty accounts
   * is worse than none: it reports "no duplicate" for the account that exists.
   */
  async checkDuplicates(name, phone) {
    const res = await apiFetch<CustomerListResponse>(
      `/customers${buildQuery({ search: phone || name, limit: 5 })}`,
    );
    return res.items;
  },
};

export const apiLeadRepository: LeadRepository = {
  list: (p = {}) => apiFetch<LeadListResponse>(`/leads${buildQuery(p)}`),
  getById: (id) => apiFetch<LeadRow>(`/leads/${id}`),
  create: (input) =>
    apiFetch<LeadRow>('/leads', { method: 'POST', body: JSON.stringify(input) }),
  update: (id, input) =>
    apiFetch<LeadRow>(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  /**
   * Stage and note are two writes because they are two records: the stage is a
   * column on the lead, the note is a Remark. The PATCH is sent first, so a
   * failed remark leaves the stage moved rather than the reverse - a stage
   * change that silently did not happen is the worse of the two.
   */
  async changeStage(id, stage, note) {
    const lead = await apiFetch<LeadRow>(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage }),
    });
    if (note) await apiLeadRepository.addRemark(id, note);
    return lead;
  },
  async addRemark(id, note) {
    await apiFetch<RemarkRow>('/remarks', {
      method: 'POST',
      body: JSON.stringify({ entityType: 'Lead', entityId: id, text: note }),
    });
  },
};

export const apiOrderRepository: OrderRepository = {
  list: (p = {}) => apiFetch<OrderListResponse>(`/orders${buildQuery(p)}`),
  getById: (id) => apiFetch<OrderRow>(`/orders/${id}`),
  create: (input) =>
    apiFetch<OrderRow>('/orders', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  advanceStatus: (id, nextStatus, note) =>
    apiFetch<OrderRow>(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus, statusNote: note ?? null }),
    }),
  cancelOrder: (id, reason) =>
    apiFetch<OrderRow>(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Cancelled', cancelReason: reason }),
    }),
};

export const apiPaymentRepository: PaymentRepository = {
  list: (p = {}) => apiFetch<PaymentListResponse>(`/payments${buildQuery(p)}`),
  getById: (id) => apiFetch<PaymentRow>(`/payments/${id}`),
  /** `receivedTotal` is cumulative - see the interface note on the race. */
  recordPayment: (id, receivedTotal) =>
    apiFetch<PaymentRow>(`/payments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ received: receivedTotal }),
    }),
  /** Marks one reminder stage sent. The caller offers only the next unsent. */
  sendReminder: (id, stage) =>
    apiFetch<PaymentRow>(`/payments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ [stage]: true }),
    }),
  async addRemark(id, note) {
    await apiFetch<RemarkRow>('/remarks', {
      method: 'POST',
      body: JSON.stringify({ entityType: 'Payment', entityId: id, text: note }),
    });
  },
};

export const apiFollowUpRepository: FollowUpRepository = {
  list: (p = {}) => apiFetch<FollowUpListResponse>(`/followups${buildQuery(p)}`),
  getById: (id) => apiFetch<FollowUpRow>(`/followups/${id}`),
  create: (input) =>
    apiFetch<FollowUpRow>('/followups', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  complete: (id, outcomeNote) =>
    apiFetch<FollowUpRow>(`/followups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        done: true,
        ...(outcomeNote ? { note: outcomeNote } : {}),
      }),
    }),
  /**
   * Snoozing moves the due date, and it moves it from TODAY rather than from
   * the date it already carries: snoozing a row that is nine days overdue by
   * three days has to mean "ask me in three days", not "make it six days
   * overdue instead of nine".
   */
  async snooze(id, days) {
    const now = new Date();
    now.setDate(now.getDate() + days);
    const dueDate = now.toISOString().slice(0, 10);
    return apiFetch<FollowUpRow>(`/followups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ dueDate }),
    });
  },
};

export const apiMappingRepository: MappingRepository = {
  list: (p = {}) => apiFetch<MappingListResponse>(`/mappings${buildQuery(p)}`),
  getById: (id) => apiFetch<MappingRow>(`/mappings/${id}`),
  create: (input) =>
    apiFetch<MappingRow>('/mappings', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updatePrice: (id, customPrice) =>
    apiFetch<MappingRow>(`/mappings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ customPrice }),
    }),
  async delete(id) {
    await apiFetch<void>(`/mappings/${id}`, { method: 'DELETE' });
  },
};

export const apiProjectionRepository: ProjectionRepository = {
  list: (p) => apiFetch<ProjectionListResponse>(`/projections${buildQuery(p)}`),
  updateStatus: (id, status, note) =>
    apiFetch<ProjectionLine>(`/projections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(note ? { note } : {}) }),
    }),
};

export const apiNotificationRepository: NotificationRepository = {
  list: (p = {}) =>
    apiFetch<NotificationListResponse>(`/notifications${buildQuery(p)}`),
  async markAsRead(id) {
    await apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' });
  },
  async markAllAsRead() {
    await apiFetch<void>('/notifications/read-all', { method: 'POST' });
  },
};

export const apiActivityRepository: ActivityRepository = {
  listByEntity: (entityType, entityId, p = {}) =>
    apiFetch<CursorPage<RemarkRow>>(
      `/remarks${buildQuery({ entityType, entityId, ...p })}`,
    ),
  log: (input) =>
    apiFetch<RemarkRow>('/remarks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};

export const apiProductRepository: ProductRepository = {
  list: (p = {}) => apiFetch<ProductListResponse>(`/products${buildQuery(p)}`),
  listPrincipals: (p = {}) =>
    apiFetch<CursorPage<PrincipalRow>>(`/principals${buildQuery(p)}`),
  /** No GET /products/:id either; the catalogue is small and comes by list. */
  async getById(id) {
    const res = await apiFetch<ProductListResponse>(
      `/products${buildQuery({ limit: 100 })}`,
    );
    return res.items.find((x) => x.id === id) ?? null;
  },
};
