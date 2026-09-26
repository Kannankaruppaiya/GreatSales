/**
 * `DataSource` backed by the GreatSales API.
 *
 * Every method maps one or more real endpoints onto the row shapes in
 * `types.ts`. Scoping is the server's: a salesperson's token only ever returns
 * their own customers, leads, orders, receivables and worksheet, so nothing
 * here filters by owner.
 *
 * Where a screen asks something the API answers in a different form — a
 * follow-up "bucket", a home roll-up — the translation is here, once, rather
 * than in each screen.
 */
import {
  DEAL_STAGE_VALUES,
  type CustomerRow,
  type DashboardKpis,
  type DealStageValue,
  type FollowUpRow,
  type LeadRow,
  type LeadStageSummaryRow,
  type MappingRow,
  type NotificationRow,
  type OrderRow,
  type OrderStatusValue,
  type PaymentRow,
  type PaymentSummary,
  type PeriodLockRow,
  type ProductRow,
  type ProjectionLine,
  type ProjectionListResponse,
  type RemarkRow,
} from "@greatsales/shared";

import { ApiError, query, request } from "./http";
import { getSessionUser } from "./session";
import type {
  CustomerInput,
  CustomerQuery,
  EntityRef,
  FollowUpInput,
  FollowUpQuery,
  HomeSummary,
  InvoiceQuery,
  LeadInput,
  LeadQuery,
  ListQuery,
  MappingQuery,
  MutableDataSource,
  Named,
  OrderInput,
  OrderQuery,
  Page,
  PaymentsSummary,
  ProjectionPatch,
  SalesProgress,
  ProjectionQuery,
  StageCount,
} from "./source";
import type {
  Activity,
  AppNotification,
  CurrentUser,
  Customer,
  FollowUp,
  Invoice,
  Lead,
  Mapping,
  Order,
  Product,
  Projection,
} from "./types";
import { DEAL_STAGE_LABELS, OPEN_STAGES } from "@/lib/stages";
import { currentPeriod, localDate, shiftPeriod } from "@/lib/format";

// ---- Row adapters -------------------------------------------------------------

function toFollowUp(row: FollowUpRow): FollowUp {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    leadId: row.entityType === "Lead" ? row.entityId : null,
    customerId: row.entityType === "Customer" ? row.entityId : null,
    customerName: row.entityName ?? row.subtitle ?? "",
    purpose: row.title ?? "Follow-up",
    subtitle: row.subtitle,
    notes: row.note,
    amount: row.amount,
    dueAt: row.dueDate,
    done: row.done,
    completedAt: row.done ? row.updatedAt : null,
    createdAt: row.createdAt,
  };
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    soNumber: row.code,
    customerId: row.customerId,
    customerName: row.customerName,
    status: row.status,
    lines: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      qty: item.qty,
      unit: item.unit,
      price: item.price,
      value: item.lineTotal,
    })),
    subtotal: row.subtotal,
    taxRate: row.taxRate,
    tax: row.taxAmount,
    total: row.total,
    paymentTerms: row.paymentTerms,
    isUrgent: row.isUrgent,
    issuedAt: row.date,
    expectedDeliveryAt: row.expectedDelivery,
    deliveryMode: row.deliveryMode,
    deliveryAddress: row.deliveryAddress,
    transporterName: row.transporterName,
    lrNumber: row.lrNumber,
    notes: row.deliveryInstructions,
    cancelReason: row.cancelReason,
    projectionId: row.projectionId,
    statusHistory: row.statusHistory.map((h) => ({
      status: h.status,
      at: h.at,
      note: h.note,
      byName: h.changedByName,
    })),
  };
}

function toInvoice(row: PaymentRow): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNo ?? row.refNo ?? row.id,
    customerId: row.customerId,
    customerName: row.customerName ?? "Unknown customer",
    invoiceDate: row.invoiceDate,
    amount: row.amount,
    received: row.received,
    pending: row.pending,
    dueAt: row.dueDate,
    agingDays: row.agingDays ?? 0,
    overdueDays: Math.max(0, row.overdueDays ?? 0),
    payZone: row.payZone,
    status: row.status,
    delayReason: row.delayReason,
    nextFollowUp: row.nextFollowUp,
    collectionNotes: row.followups,
  };
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    principalId: row.principalId,
    principal: row.principalName,
    unit: row.unit,
    listPrice: row.basePrice,
  };
}

function toMapping(row: MappingRow): Mapping {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    productId: row.productId,
    productName: row.productName,
    principalId: row.principalId,
    principal: row.principalName,
    listPrice: row.basePrice,
    agreedPrice: row.customPrice,
    effectivePrice: row.effectivePrice,
    ownerId: row.salespersonId,
    ownerName: row.salespersonName,
    createdAt: row.createdAt,
  };
}

function toProjection(line: ProjectionLine, locked: boolean): Projection {
  return {
    id: line.id,
    period: line.period,
    customerId: line.customerId,
    customerName: line.customerName,
    productId: line.productId,
    productName: line.productName,
    principalId: line.principalId,
    principal: line.principalName,
    projectedQty: line.committedQty,
    price: line.price,
    projectedValue: line.projValue,
    achievedQty: line.achievedQty,
    achievedValue: line.achValue,
    achievementPct: line.achPct,
    probability: line.probability,
    status: line.status,
    nextFollowUpAt: line.nextFollowUp,
    targetDate: line.targetDate,
    remarkCount: line.remarkCount,
    salesOrderId: line.salesOrderId,
    salesOrderStatus: line.salesOrderStatus,
    locked,
  };
}

function toNotification(row: NotificationRow): AppNotification {
  return { ...row };
}

/**
 * An activity id names where the row came from, so the detail screen can
 * reload that one row: `<entityType>~<entityId>~<kind>~<sourceId>`.
 */
function activityId(
  entity: EntityRef,
  kind: "remark" | "followup" | "stage",
  sourceId: string,
): string {
  return [entity.entityType, entity.entityId, kind, sourceId].join("~");
}

function parseActivityId(
  id: string,
): { entity: EntityRef; kind: string; sourceId: string } | null {
  const [entityType, entityId, kind, sourceId] = id.split("~");
  if (!entityType || !entityId || !kind || !sourceId) return null;
  return {
    entity: { entityType: entityType as EntityRef["entityType"], entityId },
    kind,
    sourceId,
  };
}

function pageOf<T, R>(
  page: { items: T[]; total: number; nextCursor: string | null },
  map: (row: T) => R,
): Page<R> {
  return {
    items: page.items.map(map),
    total: page.total,
    nextCursor: page.nextCursor,
  };
}

/** `null` for a 404, so a detail screen can say "not found" rather than fail. */
async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** The API's cap on one page. */
const MAX_PAGE = 100;

function clampLimit(limit: number | undefined, fallback = 20): number {
  return Math.min(Math.max(limit ?? fallback, 1), MAX_PAGE);
}

// ---- Source -------------------------------------------------------------------

export class ApiSource implements MutableDataSource {
  // ---- Identity --------------------------------------------------------------

  getCurrentUser(): Promise<CurrentUser> {
    const cached = getSessionUser();
    return cached ? Promise.resolve(cached) : request<CurrentUser>("/auth/me");
  }

  private async requireUserId(): Promise<string> {
    return (await this.getCurrentUser()).id;
  }

  // ---- Home ------------------------------------------------------------------

  async getHomeSummary(): Promise<HomeSummary> {
    const today = localDate();
    const [dueToday, overdue, stages, receivables] = await Promise.all([
      request<{ items: FollowUpRow[]; total: number }>(
        `/followups${query({ done: false, dueFrom: today, dueTo: today, limit: MAX_PAGE })}`,
      ),
      this.listFollowUps({ bucket: "overdue", limit: 1 }),
      this.getPipelineStageCounts(),
      this.getPaymentsSummary(),
    ]);
    const open = stages.filter((s) => OPEN_STAGES.includes(s.stage));
    return {
      followUpsDue: dueToday.total,
      siteVisits: dueToday.items.filter((f) =>
        /visit/i.test(`${f.title ?? ""} ${f.subtitle ?? ""}`),
      ).length,
      proposals:
        stages.find((s) => s.stage === "ProposalsAndPriceQuote")?.count ?? 0,
      overdueFollowUps: overdue.total,
      openOpportunities: open.reduce((sum, s) => sum + s.count, 0),
      openOpportunityValue: open.reduce((sum, s) => sum + s.value, 0),
      outstandingTotal: receivables.totalPending,
      overdueTotal: receivables.overdue,
    };
  }

  async getSalesProgress(period: string): Promise<SalesProgress> {
    // A month's window, first day to last. The server works out which months
    // the range covers; a projection is keyed by month, so this is one.
    const [year, month] = period.split("-").map(Number);
    const last = new Date(year!, month!, 0).getDate();
    const res = await request<{ kpis: DashboardKpis }>(
      `/dashboard${query({ from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}` })}`,
    );
    const k = res.kpis;
    return {
      period,
      recurringCommitted: k.recurringCommitted,
      recurringAchieved: k.recurringAchieved,
      newSalesCommitted: k.newSalesCommitted,
      newSalesAchieved: k.newSalesAchieved,
      totalCommitted: k.totalCommitted,
      totalAchieved: k.totalAchieved,
      target: k.target,
    };
  }

  // ---- Customers -------------------------------------------------------------

  async listCustomers(q: CustomerQuery = {}): Promise<Page<Customer>> {
    const page = await request<Page<CustomerRow>>(
      `/customers${query({
        search: q.search,
        cursor: q.cursor,
        limit: clampLimit(q.limit),
        category: q.category,
        area: q.area,
        industryId: q.industryId,
      })}`,
    );
    if (!q.withOutstanding) return page;
    // There is no outstanding filter on /customers; the balance is on the row.
    // Narrowed within the page, and said so: `total` is the page's count.
    const items = page.items.filter((c) => c.outstanding > 0);
    return { ...page, items, total: items.length };
  }

  async listAllCustomers(search?: string): Promise<Customer[]> {
    const rows: Customer[] = [];
    let cursor: string | null = null;
    // One salesperson's book, 100 at a time; capped at 2,000 accounts so a
    // runaway loop is impossible.
    for (let i = 0; i < 20; i += 1) {
      const page: Page<CustomerRow> = await request<Page<CustomerRow>>(
        `/customers${query({ search, cursor, limit: MAX_PAGE })}`,
      );
      rows.push(...page.items);
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    return rows;
  }

  getCustomer(id: string): Promise<Customer | null> {
    return orNull(request<Customer>(`/customers/${encodeURIComponent(id)}`));
  }

  listIndustries(): Promise<Named[]> {
    return request<Named[]>("/industries");
  }

  // ---- Leads -----------------------------------------------------------------

  async listLeads(q: LeadQuery = {}): Promise<Page<Lead>> {
    const stages = q.stages?.length
      ? q.stages
      : q.openOnly && !q.stage
        ? OPEN_STAGES
        : undefined;
    return request<Page<LeadRow>>(
      `/leads${query({
        search: q.search,
        cursor: q.sort === "value" ? undefined : q.cursor,
        limit: clampLimit(q.limit),
        stage: q.stage,
        stages: stages?.join(","),
        closeBefore: q.closeBefore,
        sort: q.sort,
      })}`,
    );
  }

  getLead(id: string): Promise<Lead | null> {
    return orNull(request<Lead>(`/leads/${encodeURIComponent(id)}`));
  }

  async getPipelineStageCounts(): Promise<StageCount[]> {
    const rows = await request<LeadStageSummaryRow[]>("/leads/stage-summary");
    const byStage = new Map(rows.map((r) => [r.stage, r]));
    // Every stage, in funnel order, including the empty ones — a rail that
    // drops a stage with no deals hides where the funnel is thin.
    return DEAL_STAGE_VALUES.map((stage: DealStageValue) => ({
      stage,
      count: byStage.get(stage)?.count ?? 0,
      value: byStage.get(stage)?.value ?? 0,
    }));
  }

  // ---- Follow-ups ------------------------------------------------------------

  /**
   * Buckets are the salesperson's own calendar: "today" is the device's date,
   * sent to the API as a range, so a task due today does not read as overdue
   * for the hours the server's clock is already on tomorrow.
   */
  async listFollowUps(q: FollowUpQuery = {}): Promise<Page<FollowUp>> {
    const today = localDate();
    const yesterday = localDate(-1);
    const tomorrow = localDate(1);

    const range =
      q.bucket === "overdue"
        ? { done: false, dueTo: yesterday }
        : q.bucket === "today"
          ? { done: false, dueFrom: today, dueTo: today }
          : q.bucket === "upcoming"
            ? { done: false, dueFrom: tomorrow }
            : q.bucket === "week"
              ? { done: false, dueFrom: today, dueTo: localDate(6) }
              : q.bucket === "completed"
                ? { done: true }
                : q.bucket === "open"
                  ? { done: false }
                  : {};

    const entity = q.entity
      ? { entityType: q.entity.entityType, entityId: q.entity.entityId }
      : q.leadId
        ? { entityType: "Lead", entityId: q.leadId }
        : q.customerId
          ? { entityType: "Customer", entityId: q.customerId }
          : {};

    const sort =
      q.bucket === "completed" || q.sort === "latest" ? "-due" : "due";

    const page = await request<Page<FollowUpRow>>(
      `/followups${query({
        search: q.search,
        cursor: q.cursor,
        limit: clampLimit(q.limit),
        sort,
        ...range,
        ...entity,
      })}`,
    );
    return pageOf(page, toFollowUp);
  }

  async getFollowUp(id: string): Promise<FollowUp | null> {
    const row = await orNull(
      request<FollowUpRow>(`/followups/${encodeURIComponent(id)}`),
    );
    return row ? toFollowUp(row) : null;
  }

  // ---- Orders ----------------------------------------------------------------

  async listOrders(q: OrderQuery = {}): Promise<Page<Order>> {
    const page = await request<Page<OrderRow>>(
      `/orders${query({
        search: q.search,
        cursor: q.cursor,
        limit: clampLimit(q.limit),
        status: q.status,
        customerId: q.customerId,
      })}`,
    );
    return pageOf(page, toOrder);
  }

  async getOrder(id: string): Promise<Order | null> {
    const row = await orNull(
      request<OrderRow>(`/orders/${encodeURIComponent(id)}`),
    );
    return row ? toOrder(row) : null;
  }

  // ---- Catalogue -------------------------------------------------------------

  async listProducts(
    q: ListQuery & { principalId?: string } = {},
  ): Promise<Page<Product>> {
    const page = await request<Page<ProductRow>>(
      `/products${query({
        search: q.search,
        cursor: q.cursor,
        limit: clampLimit(q.limit),
        principalId: q.principalId,
        active: true,
      })}`,
    );
    return pageOf(page, toProduct);
  }

  async listPrincipals(): Promise<Named[]> {
    const page = await request<{ items: Named[] }>(
      `/principals${query({ limit: MAX_PAGE })}`,
    );
    return page.items.map((p) => ({ id: p.id, name: p.name }));
  }

  // ---- Mappings --------------------------------------------------------------

  async listMappings(q: MappingQuery = {}): Promise<Page<Mapping>> {
    const page = await request<Page<MappingRow>>(
      `/mappings${query({
        search: q.search,
        cursor: q.cursor,
        limit: clampLimit(q.limit),
        customerId: q.customerId,
        productId: q.productId,
        principalId: q.principalId,
        unpriced: q.unpricedOnly ? "true" : undefined,
      })}`,
    );
    return pageOf(page, toMapping);
  }

  async getMapping(id: string): Promise<Mapping | null> {
    const row = await orNull(
      request<MappingRow>(`/mappings/${encodeURIComponent(id)}`),
    );
    return row ? toMapping(row) : null;
  }

  // ---- Projections -----------------------------------------------------------

  private async lockedPeriods(): Promise<Set<string>> {
    const rows = await request<PeriodLockRow[]>("/period-locks");
    return new Set(rows.map((r) => r.period));
  }

  async listProjections(q: ProjectionQuery = {}): Promise<Projection[]> {
    const period = q.period ?? currentPeriod();
    const [res, locks] = await Promise.all([
      request<ProjectionListResponse>(
        `/projections${query({
          period,
          search: q.search,
          customerId: q.customerId,
          lineFilter: q.needsFollowUp ? "due" : undefined,
        })}`,
      ),
      this.lockedPeriods(),
    ]);
    const lines = q.status
      ? res.lines.filter((l) => l.status === q.status)
      : res.lines;
    return lines.map((l) => toProjection(l, locks.has(l.period)));
  }

  async getProjection(id: string): Promise<Projection | null> {
    const [line, locks] = await Promise.all([
      orNull(request<ProjectionLine>(`/projections/${encodeURIComponent(id)}`)),
      this.lockedPeriods(),
    ]);
    return line ? toProjection(line, locks.has(line.period)) : null;
  }

  async listProjectionPeriods(): Promise<
    { period: string; locked: boolean }[]
  > {
    const locks = await this.lockedPeriods();
    const now = currentPeriod();
    const periods: string[] = [];
    for (let offset = 1; offset >= -11; offset -= 1) {
      periods.push(shiftPeriod(now, offset));
    }
    return periods.map((period) => ({ period, locked: locks.has(period) }));
  }

  // ---- Payments (read-only) --------------------------------------------------

  async getPaymentsSummary(): Promise<PaymentsSummary> {
    const s = await request<PaymentSummary>("/payments/summary");
    return {
      totalPending: s.totalPending,
      overdue: s.overdue,
      overdueCount: s.overdueCount,
      over90Days: s.over90Days,
      openCount: s.openCount,
      aging: s.aging.map((a) => ({
        bucket: a.bucket === "90+" ? "90+ days" : `${a.bucket} days`,
        amount: a.amount,
        count: a.count,
      })),
    };
  }

  async listInvoices(q: InvoiceQuery = {}): Promise<Page<Invoice>> {
    if (q.overdueOnly) return this.overdueInvoices(q);
    const page = await request<Page<PaymentRow>>(
      `/payments${query({
        search: q.search,
        cursor: q.cursor,
        limit: clampLimit(q.limit),
        customerId: q.customerId,
      })}`,
    );
    return pageOf(page, toInvoice);
  }

  /**
   * Invoices past due, most overdue first.
   *
   * NOT `?status=Overdue`: the stored status is only recomputed when an
   * invoice is written, so an invoice that fell due since its last edit still
   * reads "Pending" there. `overdueDays` is derived on every read, so this
   * walks the caller's ledger — one salesperson's receivables, in pages of
   * 100 — and keeps what is actually overdue. Capped so a runaway ledger
   * cannot turn one screen into an unbounded loop.
   */
  private async overdueInvoices(q: InvoiceQuery): Promise<Page<Invoice>> {
    const rows = (await this.walkLedger(q.search, q.customerId)).filter(
      (inv) => inv.overdueDays > 0,
    );
    rows.sort((a, b) => b.overdueDays - a.overdueDays);
    const limit = clampLimit(q.limit, MAX_PAGE);
    return {
      items: rows.slice(0, limit),
      total: rows.length,
      nextCursor: null,
    };
  }

  listOpenInvoices(search?: string): Promise<Invoice[]> {
    return this.walkLedger(search);
  }

  /**
   * The caller's open invoices, every page of them. One salesperson's
   * receivables, read in pages of 100 and capped so a runaway ledger cannot
   * turn one screen into an unbounded loop (20 pages is 2,000 invoices).
   */
  private async walkLedger(
    search?: string,
    customerId?: string,
  ): Promise<Invoice[]> {
    const rows: Invoice[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 20; i += 1) {
      const page: Page<PaymentRow> = await request<Page<PaymentRow>>(
        `/payments${query({ search, customerId, limit: MAX_PAGE, cursor })}`,
      );
      rows.push(...page.items.map(toInvoice).filter((inv) => inv.pending > 0));
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    return rows;
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const row = await orNull(
      request<PaymentRow>(`/payments/${encodeURIComponent(id)}`),
    );
    return row ? toInvoice(row) : null;
  }

  // ---- Activity --------------------------------------------------------------

  async listActivities(entity: EntityRef): Promise<Activity[]> {
    const base = {
      entityType: entity.entityType,
      entityId: entity.entityId,
      leadId: entity.entityType === "Lead" ? entity.entityId : null,
      customerId: entity.entityType === "Customer" ? entity.entityId : null,
    };

    const [remarks, followUps, lead] = await Promise.all([
      request<Page<RemarkRow>>(
        `/remarks${query({ entityType: entity.entityType, entityId: entity.entityId, limit: MAX_PAGE })}`,
      ),
      request<Page<FollowUpRow>>(
        `/followups${query({ entityType: entity.entityType, entityId: entity.entityId, limit: MAX_PAGE, sort: "-due" })}`,
      ),
      entity.entityType === "Lead" ? this.getLead(entity.entityId) : null,
    ]);

    const rows: Activity[] = [
      ...remarks.items.map((r) => ({
        ...base,
        id: activityId(entity, "remark", r.id),
        kind: "Note" as const,
        summary: r.text,
        detail: null,
        at: r.at,
        actorName: r.userName,
      })),
      ...followUps.items.map((f) => ({
        ...base,
        id: activityId(entity, "followup", f.id),
        kind: "Follow-up" as const,
        summary: `${f.done ? "Completed" : "Scheduled"}: ${f.title ?? "Follow-up"}`,
        detail: f.note,
        // A done task happened when it was ticked off; an open one is dated by
        // its due day, which has no time of day to show.
        at: f.done ? f.updatedAt : f.dueDate,
        actorName: f.salespersonName,
      })),
    ];
    if (lead?.stageUpdatedAt) {
      rows.push({
        ...base,
        id: activityId(entity, "stage", lead.id),
        kind: "Stage change",
        summary: `Moved to ${DEAL_STAGE_LABELS[lead.stage]}`,
        detail: null,
        at: lead.stageUpdatedAt,
        actorName: lead.salespersonName,
      });
    }
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  }

  async getActivity(id: string): Promise<Activity | null> {
    const parsed = parseActivityId(id);
    if (!parsed) return null;
    const rows = await this.listActivities(parsed.entity);
    return rows.find((r) => r.id === id) ?? null;
  }

  async addRemark(entity: EntityRef, text: string): Promise<Activity> {
    const row = await request<RemarkRow>("/remarks", {
      method: "POST",
      body: JSON.stringify({ ...entity, text }),
    });
    return {
      id: activityId(entity, "remark", row.id),
      entityType: entity.entityType,
      entityId: entity.entityId,
      leadId: entity.entityType === "Lead" ? entity.entityId : null,
      customerId: entity.entityType === "Customer" ? entity.entityId : null,
      kind: "Note",
      summary: row.text,
      detail: null,
      at: row.at,
      actorName: row.userName,
    };
  }

  // ---- Notifications ---------------------------------------------------------

  async listNotifications(): Promise<{
    items: AppNotification[];
    unread: number;
  }> {
    const res = await request<{ items: NotificationRow[]; unread: number }>(
      `/notifications${query({ limit: 50 })}`,
    );
    return { items: res.items.map(toNotification), unread: res.unread };
  }

  async markNotificationRead(id: string): Promise<void> {
    await request(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    });
  }

  async markAllNotificationsRead(): Promise<void> {
    await request("/notifications/read-all", { method: "POST" });
  }

  // ---- Writes ----------------------------------------------------------------

  async createCustomer(input: CustomerInput): Promise<Customer> {
    return request<Customer>("/customers", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        salespersonId: await this.requireUserId(),
      }),
    });
  }

  async deleteCustomer(id: string): Promise<void> {
    await request(`/customers/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async deleteLead(id: string): Promise<void> {
    await request(`/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async deleteFollowUp(id: string): Promise<void> {
    await request(`/followups/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async setOrderStatus(
    id: string,
    status: OrderStatusValue,
    note?: string | null,
  ): Promise<Order> {
    const row = await request<OrderRow>(`/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(note ? { statusNote: note } : {}) }),
    });
    return toOrder(row);
  }

  async cancelOrder(id: string, reason: string): Promise<Order> {
    const row = await request<OrderRow>(`/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "Cancelled",
        cancelReason: reason,
        statusNote: reason,
      }),
    });
    return toOrder(row);
  }

  async deleteOrder(id: string): Promise<void> {
    await request(`/orders/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer> {
    return request<Customer>(`/customers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  private leadBody(input: Partial<LeadInput>) {
    return {
      ...(input.customerName !== undefined
        ? { customerName: input.customerName }
        : {}),
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(input.tier !== undefined ? { tier: input.tier } : {}),
      ...(input.industryId !== undefined
        ? { industryId: input.industryId }
        : {}),
      ...(input.contacts?.length ? { contacts: input.contacts } : {}),
      ...(input.area !== undefined ? { area: input.area } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.expClose !== undefined ? { expClose: input.expClose } : {}),
      ...(input.nextFollowUp !== undefined
        ? { nextFollowUp: input.nextFollowUp }
        : {}),
      ...(input.products !== undefined
        ? {
            products: input.products.map((p) => ({
              productId: p.productId,
              productName: p.productName,
              principalId: p.principalId,
              qty: p.qty,
              unit: p.unit,
              price: p.price,
              value: p.qty != null && p.price != null ? p.qty * p.price : null,
            })),
          }
        : {}),
    };
  }

  async createLead(input: LeadInput): Promise<Lead> {
    return request<Lead>("/leads", {
      method: "POST",
      body: JSON.stringify({
        ...this.leadBody(input),
        salespersonId: await this.requireUserId(),
      }),
    });
  }

  updateLead(id: string, input: Partial<LeadInput>): Promise<Lead> {
    return request<Lead>(`/leads/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(this.leadBody(input)),
    });
  }

  changeLeadStage(id: string, stage: DealStageValue): Promise<Lead> {
    return this.updateLead(id, { stage });
  }

  async createFollowUp(input: FollowUpInput): Promise<FollowUp> {
    const row = await request<FollowUpRow>("/followups", {
      method: "POST",
      body: JSON.stringify({
        entityType: input.entityType,
        entityId: input.entityId,
        dueDate: input.dueDate,
        title: input.purpose,
        note: input.notes ?? null,
      }),
    });
    return toFollowUp(row);
  }

  async completeFollowUp(id: string, notes?: string): Promise<FollowUp> {
    const row = await request<FollowUpRow>(
      `/followups/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ done: true, ...(notes ? { note: notes } : {}) }),
      },
    );
    return toFollowUp(row);
  }

  async annotateFollowUp(id: string, notes: string): Promise<FollowUp> {
    const row = await request<FollowUpRow>(
      `/followups/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ note: notes }),
      },
    );
    return toFollowUp(row);
  }

  /** No code is sent: the API numbers the order in the tenant's sequence. */
  async createOrder(input: OrderInput): Promise<Order> {
    const row = await request<OrderRow>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId: input.customerId,
        salespersonId: await this.requireUserId(),
        items: input.lines.map((line) => ({
          productId: line.productId,
          qty: line.qty,
          price: line.price,
          unit: line.unit ?? null,
        })),
        taxMode: "Percentage",
        taxRate: input.taxRate ?? 18,
        isUrgent: input.isUrgent ?? false,
        paymentTerms: input.paymentTerms ?? null,
        deliveryAddress: input.deliveryAddress ?? null,
        expectedDelivery: input.expectedDeliveryAt ?? null,
        deliveryInstructions: input.notes ?? null,
        ...(input.projectionId ? { projectionId: input.projectionId } : {}),
      }),
    });
    return toOrder(row);
  }

  async createMapping(input: {
    customerId: string;
    productId: string;
    agreedPrice: number | null;
  }): Promise<Mapping> {
    const row = await request<MappingRow>("/mappings", {
      method: "POST",
      body: JSON.stringify({
        customerId: input.customerId,
        productId: input.productId,
        customPrice: input.agreedPrice,
      }),
    });
    return toMapping(row);
  }

  async updateMapping(
    id: string,
    input: { agreedPrice: number | null },
  ): Promise<Mapping> {
    const row = await request<MappingRow>(
      `/mappings/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ customPrice: input.agreedPrice }),
      },
    );
    return toMapping(row);
  }

  async deleteMapping(id: string): Promise<void> {
    await request(`/mappings/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async updateProjection(
    id: string,
    input: ProjectionPatch,
  ): Promise<Projection> {
    await request(`/projections/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.projectedQty !== undefined
          ? { committedQty: input.projectedQty }
          : {}),
        ...(input.achievedQty !== undefined
          ? { achievedQty: input.achievedQty }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.probability !== undefined
          ? { probability: input.probability }
          : {}),
        ...(input.nextFollowUpAt !== undefined
          ? { nextFollowUp: input.nextFollowUpAt }
          : {}),
        ...(input.targetDate !== undefined
          ? { targetDate: input.targetDate }
          : {}),
      }),
    });
    // Re-read: the worksheet's derived figures (value, achievement) are the
    // engine's, not a local recomputation.
    const fresh = await this.getProjection(id);
    if (!fresh) throw new ApiError(404, "Projection not found");
    return fresh;
  }

  async deleteProjection(id: string): Promise<void> {
    await request(`/projections/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async rollForwardProjections(period: string): Promise<{ created: number }> {
    const res = await request<{ created: number }>(
      "/projections/roll-forward",
      {
        method: "POST",
        body: JSON.stringify({ to: period }),
      },
    );
    return { created: res.created };
  }
}

export function createApiSource(): MutableDataSource {
  return new ApiSource();
}
