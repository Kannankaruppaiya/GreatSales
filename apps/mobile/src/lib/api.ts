import type {
  AddLeadActivityInput,
  AddPaymentFollowupInput,
  ApiErrorBody,
  AuthTokens,
  AuthUser,
  CreateCustomerInput,
  CreateLeadInput,
  CreateOrderInput,
  CreatePaymentInput,
  CursorPage,
  Customer,
  CustomerDetail,
  DashboardSummary,
  Lead,
  LeadDetail,
  LoginResponse,
  Lookups,
  Order,
  OrderDetail,
  Payment,
  PaymentDetail,
  UpdateCustomerInput,
  UpdateLeadInput,
  UpdateOrderStatusInput,
  UpdatePaymentInput,
} from '@greatsales/shared';
import { storage, StorageKeys } from './storage';

/**
 * Base URL of the GreatSales API. Override per environment with
 * EXPO_PUBLIC_API_URL (e.g. a LAN IP so a physical device can reach your dev
 * machine). Defaults to localhost for the simulator/web.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/** Error carrying the API's normalized envelope + HTTP status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

/** Load any persisted tokens into memory (called once at app start). */
async function hydrate(): Promise<void> {
  accessToken = await storage.get(StorageKeys.accessToken);
  refreshToken = await storage.get(StorageKeys.refreshToken);
}

async function persistTokens(tokens: AuthTokens): Promise<void> {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  await storage.set(StorageKeys.accessToken, tokens.accessToken);
  await storage.set(StorageKeys.refreshToken, tokens.refreshToken);
}

async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await storage.remove(StorageKeys.accessToken);
  await storage.remove(StorageKeys.refreshToken);
}

function hasSession(): boolean {
  return accessToken != null;
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const body = data as ApiErrorBody | undefined;
    throw new ApiError(res.status, body?.message ?? res.statusText, body);
  }
  return data as T;
}

/** Try to exchange the refresh token for a new pair. Single-flight. */
async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const tokens = (await res.json()) as AuthTokens;
      await persistTokens(tokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | undefined>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query } = opts;

  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await send();
  if (res.status === 401 && auth && refreshToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await send();
    } else {
      await clearTokens();
    }
  }
  return parse<T>(res);
}

/** Typed API surface used by screens. */
export const api = {
  hydrate,
  clearTokens,
  hasSession,

  async login(
    tenantId: string,
    email: string,
    password: string,
  ): Promise<LoginResponse> {
    const res = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      body: { tenantId, email, password },
    });
    await persistTokens({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
    });
    return res;
  },

  async logout(): Promise<void> {
    await clearTokens();
  },

  me(): Promise<AuthUser> {
    return request<AuthUser>('/auth/me');
  },

  dashboardSummary(): Promise<DashboardSummary> {
    return request<DashboardSummary>('/dashboard/summary');
  },

  lookups(): Promise<Lookups> {
    return request<Lookups>('/lookups');
  },

  customers: {
    list: (cursor?: string) =>
      request<CursorPage<Customer>>('/customers', { query: { cursor } }),
    get: (id: string) => request<CustomerDetail>(`/customers/${id}`),
    create: (input: CreateCustomerInput) =>
      request<Customer>('/customers', { method: 'POST', body: input }),
    update: (id: string, input: UpdateCustomerInput) =>
      request<Customer>(`/customers/${id}`, { method: 'PATCH', body: input }),
    remove: (id: string) =>
      request<{ id: string }>(`/customers/${id}`, { method: 'DELETE' }),
  },

  leads: {
    list: (cursor?: string) =>
      request<CursorPage<Lead>>('/leads', { query: { cursor } }),
    get: (id: string) => request<LeadDetail>(`/leads/${id}`),
    create: (input: CreateLeadInput) =>
      request<Lead>('/leads', { method: 'POST', body: input }),
    update: (id: string, input: UpdateLeadInput) =>
      request<Lead>(`/leads/${id}`, { method: 'PATCH', body: input }),
    addActivity: (id: string, input: AddLeadActivityInput) =>
      request<LeadDetail>(`/leads/${id}/activities`, {
        method: 'POST',
        body: input,
      }),
  },

  orders: {
    list: (cursor?: string) =>
      request<CursorPage<Order>>('/orders', { query: { cursor } }),
    get: (id: string) => request<OrderDetail>(`/orders/${id}`),
    create: (input: CreateOrderInput) =>
      request<Order>('/orders', { method: 'POST', body: input }),
    updateStatus: (id: string, input: UpdateOrderStatusInput) =>
      request<Order>(`/orders/${id}/status`, { method: 'PATCH', body: input }),
  },

  payments: {
    list: (cursor?: string) =>
      request<CursorPage<Payment>>('/payments', { query: { cursor } }),
    get: (id: string) => request<PaymentDetail>(`/payments/${id}`),
    create: (input: CreatePaymentInput) =>
      request<Payment>('/payments', { method: 'POST', body: input }),
    update: (id: string, input: UpdatePaymentInput) =>
      request<Payment>(`/payments/${id}`, { method: 'PATCH', body: input }),
    addFollowup: (id: string, input: AddPaymentFollowupInput) =>
      request<PaymentDetail>(`/payments/${id}/followups`, {
        method: 'POST',
        body: input,
      }),
  },
};
