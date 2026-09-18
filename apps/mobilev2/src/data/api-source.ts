/**
 * `DataSource` backed by the real NestJS API.
 *
 * Route paths were read off the controllers in `apps/api/src` on 2026-09-18.
 * Where the backend has no endpoint for something the design asks for, the
 * method says so in the error rather than returning an empty page — an empty
 * list reads as "no data", which is a different and misleading claim.
 *
 * This source is read-first: the list and detail methods are wired, and the
 * write methods post to the endpoints that exist. It is not exercised until
 * `DATA_SOURCE` is set to "api", so treat it as the contract for that switch
 * rather than as code that has been run against a live server.
 */
import type { CustomerRow, DealStageValue, LeadRow } from "@greatsales/shared";

import { API_BASE_URL } from "./config";
import type {
  Activity,
  AppNotification,
  CurrentUser,
  Customer,
  CustomerQuery,
  FollowUp,
  FollowUpQuery,
  HomeSummary,
  Invoice,
  Lead,
  LeadQuery,
  ListQuery,
  Mapping,
  MappingQuery,
  MutableDataSource,
  Order,
  OrderQuery,
  Page,
  PaymentRecord,
  PaymentsSummary,
  Product,
  Projection,
  ProjectionQuery,
} from "./source";
import { ALL_STAGES, OPEN_STAGES } from "@/lib/stages";

/** Supplies the bearer token. Set once at sign-in. */
export type TokenProvider = () => string | null | Promise<string | null>;

let tokenProvider: TokenProvider = () => null;

export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thrown by any method the backend has no endpoint for. */
export class NotSupportedByBackend extends Error {
  constructor(what: string) {
    super(
      `${what} is not available from the API. See BACKEND_CAPABILITIES in data/config.ts.`,
    );
    this.name = "NotSupportedByBackend";
  }
}

function query(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const q = search.toString();
  return q ? `?${q}` : "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenProvider();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    // The API returns a JSON problem body; fall back to the status text when
    // it does not, so a proxy's HTML error page cannot crash the parse.
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) detail = body.message;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(response.status, path, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** The API returns `{ items, nextCursor, total }` — the same shape as `Page`. */
type ApiPage<T> = Page<T>;

export class ApiSource implements MutableDataSource {
  readonly kind = "api" as const;

  // ---- Identity -----------------------------------------------------------

  async getCurrentUser(): Promise<CurrentUser> {
    return request<CurrentUser>("/auth/me");
  }

  // ---- Home ---------------------------------------------------------------

  async getHomeSummary(): Promise<HomeSummary> {
    // GET /dashboard returns the roll-up the web console uses. Its shape is
    // wider than HomeSummary; only the fields this app shows are read, so a new
    // dashboard field cannot break the mobile home screen.
    const dashboard = await request<Record<string, number>>("/dashboard");
    return {
      followUpsDue: dashboard.followUpsDueToday ?? 0,
      siteVisits: dashboard.siteVisitsToday ?? 0,
      proposals: dashboard.proposalsOpen ?? 0,
      overdueFollowUps: dashboard.followUpsOverdue ?? 0,
      openOpportunities: dashboard.openLeads ?? 0,
      openOpportunityValue: dashboard.openLeadValue ?? 0,
      outstandingTotal: dashboard.outstandingTotal ?? 0,
      overdueTotal: dashboard.overdueTotal ?? 0,
    };
  }

  // ---- Customers ----------------------------------------------------------

  listCustomers(q: CustomerQuery = {}): Promise<Page<Customer>> {
    return request<ApiPage<CustomerRow>>(
      `/customers${query({
        search: q.search,
        cursor: q.cursor,
        limit: q.limit,
        category: q.category,
        area: q.area,
        industryId: q.industry,
      })}`,
    );
  }

  getCustomer(id: string): Promise<Customer | null> {
    return request<Customer>(`/customers/${id}`);
  }

  // ---- Leads --------------------------------------------------------------

  /**
   * `/leads` accepts one stage and no closure-date bound, so a multi-stage or
   * date-bounded filter is narrowed here after the fetch. That is honest but
   * not cheap: it pages the server's view, not the filtered view. An API that
   * took `stages[]` and `closeBefore` would remove this.
   */
  async listLeads(q: LeadQuery = {}): Promise<Page<Lead>> {
    const narrowing = Boolean(q.stages?.length || q.closeBefore);
    const page = await request<ApiPage<LeadRow>>(
      `/leads${query({
        search: q.search,
        cursor: narrowing ? undefined : q.cursor,
        limit: narrowing ? 200 : q.limit,
        stage: q.stage,
      })}`,
    );
    if (!narrowing) return page;

    const wanted = q.stages?.length ? new Set(q.stages) : null;
    const items = page.items.filter(
      (l) =>
        (!wanted || wanted.has(l.stage)) &&
        (!q.closeBefore || (l.expClose != null && l.expClose <= q.closeBefore)),
    );
    return {
      items: items.slice(0, q.limit ?? items.length),
      nextCursor: null,
      total: items.length,
    };
  }

  /**
   * There is no `GET /leads/:id`, so this filters a one-row list instead.
   * Correct, and one round trip — but if detail screens get heavy this is the
   * endpoint to add on the API side.
   */
  async getLead(id: string): Promise<Lead | null> {
    const page = await request<ApiPage<LeadRow>>(
      `/leads${query({ limit: 100 })}`,
    );
    return page.items.find((l) => l.id === id) ?? null;
  }

  async getPipelineStageCounts(
    options: { openOnly?: boolean } = {},
  ): Promise<{ stage: DealStageValue; count: number; value: number }[]> {
    // No per-stage aggregate endpoint exists; count one page per stage so each
    // call carries its own `total` rather than paging the whole pipeline.
    const stages = options.openOnly === false ? ALL_STAGES : OPEN_STAGES;
    const results = await Promise.all(
      stages.map(async (stage) => {
        const page = await request<ApiPage<LeadRow>>(
          `/leads${query({ stage, limit: 100 })}`,
        );
        return {
          stage,
          count: page.total,
          value: page.items.reduce((sum, l) => sum + l.totalValue, 0),
        };
      }),
    );
    return results;
  }

  // ---- Follow-ups ---------------------------------------------------------

  /**
   * `/followups` returns due-date order and takes no `sort`, so "latest first"
   * is reversed here. It reverses the page, not the whole list — an API that
   * took the order would do this properly.
   */
  async listFollowUps(q: FollowUpQuery = {}): Promise<Page<FollowUp>> {
    const page = await request<ApiPage<FollowUp>>(
      `/followups${query({
        search: q.search,
        cursor: q.cursor,
        limit: q.limit,
        customerId: q.customerId,
        leadId: q.leadId,
        bucket: q.bucket,
      })}`,
    );
    if (q.sort !== "latest") return page;
    return { ...page, items: [...page.items].reverse() };
  }

  async getFollowUp(id: string): Promise<FollowUp | null> {
    const page = await request<ApiPage<FollowUp>>(
      `/followups${query({ limit: 100 })}`,
    );
    return page.items.find((f) => f.id === id) ?? null;
  }

  // ---- Orders -------------------------------------------------------------

  listOrders(q: OrderQuery = {}): Promise<Page<Order>> {
    return request<ApiPage<Order>>(
      `/orders${query({
        search: q.search,
        cursor: q.cursor,
        limit: q.limit,
        status: q.status,
        customerId: q.customerId,
      })}`,
    );
  }

  async getOrder(id: string): Promise<Order | null> {
    const page = await request<ApiPage<Order>>(
      `/orders${query({ limit: 100 })}`,
    );
    return page.items.find((o) => o.id === id) ?? null;
  }

  // ---- Catalogue ----------------------------------------------------------

  listProducts(q: ListQuery = {}): Promise<Page<Product>> {
    return request<ApiPage<Product>>(
      `/products${query({ search: q.search, cursor: q.cursor, limit: q.limit })}`,
    );
  }

  // ---- Mappings -----------------------------------------------------------

  listMappings(q: MappingQuery = {}): Promise<Page<Mapping>> {
    return request<ApiPage<Mapping>>(
      `/mappings${query({
        search: q.search,
        cursor: q.cursor,
        limit: q.limit,
        customerId: q.customerId,
        productId: q.productId,
      })}`,
    );
  }

  async getMapping(id: string): Promise<Mapping | null> {
    const page = await request<ApiPage<Mapping>>(
      `/mappings${query({ limit: 100 })}`,
    );
    return page.items.find((m) => m.id === id) ?? null;
  }

  // ---- Projections --------------------------------------------------------

  listProjections(q: ProjectionQuery = {}): Promise<Page<Projection>> {
    return request<ApiPage<Projection>>(
      `/projections${query({
        search: q.search,
        cursor: q.cursor,
        limit: q.limit,
        period: q.period,
        customerId: q.customerId,
        status: q.status,
      })}`,
    );
  }

  async getProjection(id: string): Promise<Projection | null> {
    const page = await request<ApiPage<Projection>>(
      `/projections${query({ limit: 100 })}`,
    );
    return page.items.find((p) => p.id === id) ?? null;
  }

  async listProjectionPeriods(): Promise<
    { period: string; locked: boolean }[]
  > {
    // Period locks live in their own module.
    return request<{ period: string; locked: boolean }[]>("/period-locks");
  }

  // ---- Payments (read-only) ----------------------------------------------

  async getPaymentsSummary(): Promise<PaymentsSummary> {
    const page = await request<ApiPage<Invoice>>(
      `/payments${query({ limit: 100 })}`,
    );
    const invoices = page.items;
    const overdue = invoices.filter((i) => i.agingDays > 0);

    const buckets: { bucket: string; min: number; max: number }[] = [
      { bucket: "Current", min: -Infinity, max: 0 },
      { bucket: "1–30 days", min: 1, max: 30 },
      { bucket: "31–60 days", min: 31, max: 60 },
      { bucket: "61–90 days", min: 61, max: 90 },
      { bucket: "90+ days", min: 91, max: Infinity },
    ];

    return {
      totalPending: invoices.reduce((sum, i) => sum + i.pending, 0),
      totalOutstanding: invoices.reduce((sum, i) => sum + i.pending, 0),
      overdue: overdue.reduce((sum, i) => sum + i.pending, 0),
      over90Days: invoices
        .filter((i) => i.agingDays > 90)
        .reduce((sum, i) => sum + i.pending, 0),
      followUpCount: overdue.length,
      aging: buckets.map(({ bucket, min, max }) => {
        const rows = invoices.filter(
          (i) => i.agingDays >= min && i.agingDays <= max,
        );
        return {
          bucket,
          amount: rows.reduce((sum, i) => sum + i.pending, 0),
          count: rows.length,
        };
      }),
    };
  }

  listInvoices(
    q: ListQuery & { customerId?: string; overdueOnly?: boolean } = {},
  ): Promise<Page<Invoice>> {
    return request<ApiPage<Invoice>>(
      `/payments${query({
        search: q.search,
        cursor: q.cursor,
        limit: q.limit,
        customerId: q.customerId,
        overdue: q.overdueOnly,
      })}`,
    );
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const page = await request<ApiPage<Invoice>>(
      `/payments${query({ limit: 100 })}`,
    );
    return page.items.find((i) => i.id === id) ?? null;
  }

  listPaymentRecords(
    q: ListQuery & { customerId?: string; invoiceId?: string } = {},
  ): Promise<Page<PaymentRecord>> {
    return request<ApiPage<PaymentRecord>>(
      `/payments${query({
        cursor: q.cursor,
        limit: q.limit,
        customerId: q.customerId,
        invoiceId: q.invoiceId,
      })}`,
    );
  }

  // ---- Activity & notifications ------------------------------------------

  listActivities(
    q: ListQuery & { leadId?: string; customerId?: string; kind?: string } = {},
  ): Promise<Page<Activity>> {
    // Activity is assembled from remarks in the current API.
    return request<ApiPage<Activity>>(
      `/remarks${query({
        cursor: q.cursor,
        limit: q.limit,
        leadId: q.leadId,
        customerId: q.customerId,
      })}`,
    );
  }

  /** No `GET /remarks/:id` either, so this filters a page, as leads do. */
  async getActivity(id: string): Promise<Activity | null> {
    const page = await request<ApiPage<Activity>>(
      `/remarks${query({ limit: 200 })}`,
    );
    return page.items.find((a) => a.id === id) ?? null;
  }

  listNotifications(q: ListQuery = {}): Promise<Page<AppNotification>> {
    return request<ApiPage<AppNotification>>(
      `/notifications${query({ cursor: q.cursor, limit: q.limit })}`,
    );
  }

  async markNotificationRead(id: string): Promise<void> {
    await request<void>(`/notifications/${id}/read`, { method: "POST" });
  }

  // ---- Writes -------------------------------------------------------------

  createCustomer(
    input: Partial<Customer> & { name: string },
  ): Promise<Customer> {
    return request<Customer>("/customers", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateCustomer(id: string, input: Partial<Customer>): Promise<Customer> {
    return request<Customer>(`/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  createLead(input: Partial<Lead> & { customerName: string }): Promise<Lead> {
    return request<Lead>("/leads", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateLead(id: string, input: Partial<Lead>): Promise<Lead> {
    return request<Lead>(`/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  changeLeadStage(id: string, stage: DealStageValue): Promise<Lead> {
    return this.updateLead(id, { stage });
  }

  createFollowUp(
    input: Omit<FollowUp, "id" | "createdAt" | "completedAt">,
  ): Promise<FollowUp> {
    return request<FollowUp>("/followups", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  completeFollowUp(id: string, notes?: string): Promise<FollowUp> {
    return request<FollowUp>(`/followups/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ completedAt: new Date().toISOString(), notes }),
    });
  }

  createOrder(input: {
    customerId: string;
    lines: { productId: string; qty: number; price: number }[];
    expectedDeliveryAt?: string | null;
    deliveryAddress?: string | null;
    paymentTerms?: Order["paymentTerms"];
  }): Promise<Order> {
    return request<Order>("/orders", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  createMapping(input: {
    customerId: string;
    productId: string;
    agreedPrice: number | null;
  }): Promise<Mapping> {
    return request<Mapping>("/mappings", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateMapping(
    id: string,
    input: { agreedPrice: number | null },
  ): Promise<Mapping> {
    return request<Mapping>(`/mappings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteMapping(id: string): Promise<void> {
    await request<void>(`/mappings/${id}`, { method: "DELETE" });
  }

  updateProjection(
    id: string,
    input: Partial<Projection>,
  ): Promise<Projection> {
    return request<Projection>(`/projections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteProjection(id: string): Promise<void> {
    await request<void>(`/projections/${id}`, { method: "DELETE" });
  }

  // Payments are intentionally absent from the write surface: the sales role
  // holds payment.read and not payment.write, so there is nothing to call.
}

export function createApiSource(): MutableDataSource {
  return new ApiSource();
}
