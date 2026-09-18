/**
 * `MutableDataSource` backed by the generated synthetic dataset.
 *
 * All filtering, sorting and paging happens in memory over the generated rows.
 * Writes mutate the in-memory dataset so a create flow can be walked end to end
 * and the new row shows up in the list behind it; nothing is persisted, so a
 * reload returns to the generated baseline.
 */
import type { DealStageValue } from "@greatsales/shared";

import type {
  Activity,
  AppNotification,
  CurrentUser,
  Customer,
  CustomerQuery,
  DataSource,
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
import { generateDataset, type SyntheticDataset } from "./synthetic/dataset";
import { ALL_STAGES, OPEN_STAGES } from "@/lib/stages";

const DEFAULT_LIMIT = 20;

function startOfDay(d: Date): number {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function matches(
  haystack: (string | null | undefined)[],
  needle: string,
): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return haystack.some((h) => (h ?? "").toLowerCase().includes(q));
}

/**
 * Cursor paging over an in-memory array.
 *
 * The cursor is the offset as a string. That is opaque enough for the screens
 * (which only ever pass back what they were given) and keeps the synthetic
 * source honest about the shape the API returns.
 */
function paginate<T>(rows: T[], query: ListQuery | undefined): Page<T> {
  const limit = query?.limit ?? DEFAULT_LIMIT;
  const offset = query?.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
  const slice = rows.slice(offset, offset + limit);
  const next = offset + limit;
  return {
    items: slice,
    total: rows.length,
    nextCursor: next < rows.length ? String(next) : null,
  };
}

/** A small delay so loading states are actually exercised in development. */
async function settle<T>(value: T, ms = 0): Promise<T> {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  return value;
}

export interface SyntheticSourceOptions {
  seed?: string;
  now?: Date;
  /** Artificial latency in ms, so skeletons and spinners get exercised. */
  latencyMs?: number;
}

export class SyntheticSource implements MutableDataSource {
  readonly kind = "synthetic" as const;

  private data: SyntheticDataset;
  private readonly latency: number;
  private sequence = 0;

  constructor(options: SyntheticSourceOptions = {}) {
    this.data = generateDataset({ seed: options.seed, now: options.now });
    this.latency = options.latencyMs ?? 0;
  }

  /** Regenerate from a different seed — useful from a dev menu. */
  reseed(seed: string): void {
    this.data = generateDataset({ seed, now: this.data.now });
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-new-${this.sequence}`;
  }

  // ---- Identity -----------------------------------------------------------

  getCurrentUser(): Promise<CurrentUser> {
    return settle(this.data.user, this.latency);
  }

  // ---- Home ---------------------------------------------------------------

  async getHomeSummary(): Promise<HomeSummary> {
    const today = startOfDay(this.data.now);
    const open = this.data.followUps.filter((f) => f.completedAt == null);

    const dueToday = open.filter(
      (f) => startOfDay(new Date(f.dueAt)) === today,
    ).length;
    const overdue = open.filter(
      (f) => startOfDay(new Date(f.dueAt)) < today,
    ).length;

    const openLeads = this.data.leads.filter((l) =>
      OPEN_STAGES.includes(l.stage),
    );
    const proposals = this.data.leads.filter(
      (l) => l.stage === "ProposalsAndPriceQuote",
    ).length;

    const outstandingTotal = this.data.customers.reduce(
      (sum, c) => sum + c.outstanding,
      0,
    );
    const overdueTotal = this.data.invoices
      .filter((i) => i.agingDays > 0)
      .reduce((sum, i) => sum + i.pending, 0);

    // "Site visits" is not a stored entity; it is the subset of today's
    // follow-ups whose purpose is a visit. Derived, so it can never disagree
    // with the follow-up list the user opens next.
    const siteVisits = open.filter(
      (f) =>
        startOfDay(new Date(f.dueAt)) === today &&
        f.purpose.toLowerCase().includes("visit"),
    ).length;

    return settle(
      {
        followUpsDue: dueToday,
        siteVisits,
        proposals,
        overdueFollowUps: overdue,
        openOpportunities: openLeads.length,
        openOpportunityValue: openLeads.reduce(
          (sum, l) => sum + l.totalValue,
          0,
        ),
        outstandingTotal,
        overdueTotal,
      },
      this.latency,
    );
  }

  // ---- Customers ----------------------------------------------------------

  async listCustomers(query: CustomerQuery = {}): Promise<Page<Customer>> {
    let rows = [...this.data.customers];
    if (query.search) {
      rows = rows.filter((c) =>
        matches(
          [
            c.name,
            c.area,
            c.industryName,
            c.primaryContactName,
            c.primaryContactPhone,
          ],
          query.search!,
        ),
      );
    }
    if (query.category)
      rows = rows.filter((c) => c.category === query.category);
    if (query.area) rows = rows.filter((c) => c.area === query.area);
    if (query.industry)
      rows = rows.filter((c) => c.industryName === query.industry);
    if (query.withOutstanding) rows = rows.filter((c) => c.outstanding > 0);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return settle(paginate(rows, query), this.latency);
  }

  async getCustomer(id: string): Promise<Customer | null> {
    return settle(
      this.data.customers.find((c) => c.id === id) ?? null,
      this.latency,
    );
  }

  // ---- Leads --------------------------------------------------------------

  async listLeads(query: LeadQuery = {}): Promise<Page<Lead>> {
    let rows = [...this.data.leads];
    if (query.search) {
      rows = rows.filter((l) =>
        matches(
          [l.customerName, l.contactName, l.area, l.industryName],
          query.search!,
        ),
      );
    }
    if (query.stage) rows = rows.filter((l) => l.stage === query.stage);
    if (query.stages?.length) {
      const wanted = new Set(query.stages);
      rows = rows.filter((l) => wanted.has(l.stage));
    }
    if (query.closeBefore) {
      // A deal with no expected closure date cannot satisfy a closure filter,
      // so it drops out rather than being treated as "closing today".
      rows = rows.filter(
        (l) => l.expClose != null && l.expClose <= query.closeBefore!,
      );
    }
    if (query.openOnly)
      rows = rows.filter((l) => OPEN_STAGES.includes(l.stage));

    switch (query.sort) {
      case "value":
        rows.sort((a, b) => b.totalValue - a.totalValue);
        break;
      case "closeDate":
        rows.sort((a, b) =>
          (a.expClose ?? "9999").localeCompare(b.expClose ?? "9999"),
        );
        break;
      case "recent":
      default:
        rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        break;
    }
    return settle(paginate(rows, query), this.latency);
  }

  async getLead(id: string): Promise<Lead | null> {
    return settle(
      this.data.leads.find((l) => l.id === id) ?? null,
      this.latency,
    );
  }

  async getPipelineStageCounts(
    options: { openOnly?: boolean } = {},
  ): Promise<{ stage: DealStageValue; count: number; value: number }[]> {
    const stages = options.openOnly === false ? ALL_STAGES : OPEN_STAGES;
    const byStage = new Map<DealStageValue, { count: number; value: number }>();
    for (const stage of stages) byStage.set(stage, { count: 0, value: 0 });
    for (const lead of this.data.leads) {
      const entry = byStage.get(lead.stage);
      if (!entry) continue;
      entry.count += 1;
      entry.value += lead.totalValue;
    }
    return settle(
      [...byStage.entries()].map(([stage, v]) => ({ stage, ...v })),
      this.latency,
    );
  }

  // ---- Follow-ups ---------------------------------------------------------

  async listFollowUps(query: FollowUpQuery = {}): Promise<Page<FollowUp>> {
    const today = startOfDay(this.data.now);
    let rows = [...this.data.followUps];

    if (query.customerId)
      rows = rows.filter((f) => f.customerId === query.customerId);
    if (query.leadId) rows = rows.filter((f) => f.leadId === query.leadId);
    if (query.search) {
      rows = rows.filter((f) =>
        matches([f.customerName, f.purpose, f.notes], query.search!),
      );
    }

    if (query.bucket) {
      rows = rows.filter((f) => {
        const due = startOfDay(new Date(f.dueAt));
        switch (query.bucket) {
          case "completed":
            return f.completedAt != null;
          case "overdue":
            return f.completedAt == null && due < today;
          case "today":
            return f.completedAt == null && due === today;
          case "upcoming":
            return f.completedAt == null && due > today;
          default:
            return true;
        }
      });
    }

    rows.sort((a, b) => {
      // Completed follow-ups read newest-first: what was done most recently is
      // what a person is checking on.
      if (query.bucket === "completed") {
        return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
      }
      return query.sort === "latest"
        ? b.dueAt.localeCompare(a.dueAt)
        : a.dueAt.localeCompare(b.dueAt);
    });
    return settle(paginate(rows, query), this.latency);
  }

  async getFollowUp(id: string): Promise<FollowUp | null> {
    return settle(
      this.data.followUps.find((f) => f.id === id) ?? null,
      this.latency,
    );
  }

  // ---- Orders -------------------------------------------------------------

  async listOrders(query: OrderQuery = {}): Promise<Page<Order>> {
    let rows = [...this.data.orders];
    if (query.customerId)
      rows = rows.filter((o) => o.customerId === query.customerId);
    if (query.status) rows = rows.filter((o) => o.status === query.status);
    if (query.search) {
      rows = rows.filter((o) =>
        matches([o.soNumber, o.customerName], query.search!),
      );
    }
    rows.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    return settle(paginate(rows, query), this.latency);
  }

  async getOrder(id: string): Promise<Order | null> {
    return settle(
      this.data.orders.find((o) => o.id === id) ?? null,
      this.latency,
    );
  }

  // ---- Catalogue ----------------------------------------------------------

  async listProducts(query: ListQuery = {}): Promise<Page<Product>> {
    let rows = [...this.data.products];
    if (query.search) {
      rows = rows.filter((p) => matches([p.name, p.principal], query.search!));
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return settle(paginate(rows, query), this.latency);
  }

  // ---- Mappings -----------------------------------------------------------

  async listMappings(query: MappingQuery = {}): Promise<Page<Mapping>> {
    let rows = this.data.mappings.filter((m) => m.active);
    if (query.customerId)
      rows = rows.filter((m) => m.customerId === query.customerId);
    if (query.productId)
      rows = rows.filter((m) => m.productId === query.productId);
    if (query.principal)
      rows = rows.filter((m) => m.principal === query.principal);
    if (query.unpricedOnly) rows = rows.filter((m) => m.agreedPrice == null);
    if (query.search) {
      rows = rows.filter((m) =>
        matches([m.customerName, m.productName, m.principal], query.search!),
      );
    }
    rows.sort((a, b) => a.customerName.localeCompare(b.customerName));
    return settle(paginate(rows, query), this.latency);
  }

  async getMapping(id: string): Promise<Mapping | null> {
    return settle(
      this.data.mappings.find((m) => m.id === id) ?? null,
      this.latency,
    );
  }

  // ---- Projections --------------------------------------------------------

  async listProjections(
    query: ProjectionQuery = {},
  ): Promise<Page<Projection>> {
    const currentPeriod = `${this.data.now.getFullYear()}-${String(
      this.data.now.getMonth() + 1,
    ).padStart(2, "0")}`;
    const wanted = query.period ?? currentPeriod;

    let rows = this.data.projections.filter((p) => p.period === wanted);
    if (query.customerId)
      rows = rows.filter((p) => p.customerId === query.customerId);
    if (query.status) rows = rows.filter((p) => p.status === query.status);
    if (query.needsFollowUp)
      rows = rows.filter((p) => p.nextFollowUpAt != null);
    if (query.search) {
      rows = rows.filter((p) =>
        matches([p.customerName, p.productName, p.principal], query.search!),
      );
    }
    rows.sort((a, b) => b.projectedValue - a.projectedValue);
    return settle(paginate(rows, query), this.latency);
  }

  async getProjection(id: string): Promise<Projection | null> {
    return settle(
      this.data.projections.find((p) => p.id === id) ?? null,
      this.latency,
    );
  }

  async listProjectionPeriods(): Promise<
    { period: string; locked: boolean }[]
  > {
    const seen = new Map<string, boolean>();
    for (const p of this.data.projections) {
      // A period is locked if any of its rows say so; they are generated
      // consistently, so the first one decides.
      if (!seen.has(p.period)) seen.set(p.period, p.locked);
    }
    return settle(
      [...seen.entries()]
        .map(([period, locked]) => ({ period, locked }))
        .sort((a, b) => b.period.localeCompare(a.period)),
      this.latency,
    );
  }

  // ---- Payments (read-only) ----------------------------------------------

  async getPaymentsSummary(): Promise<PaymentsSummary> {
    const invoices = this.data.invoices;
    const totalPending = invoices.reduce((sum, i) => sum + i.pending, 0);
    const overdueInvoices = invoices.filter((i) => i.agingDays > 0);
    const over90 = invoices.filter((i) => i.agingDays > 90);

    const buckets: { bucket: string; min: number; max: number }[] = [
      { bucket: "Current", min: -Infinity, max: 0 },
      { bucket: "1–30 days", min: 1, max: 30 },
      { bucket: "31–60 days", min: 31, max: 60 },
      { bucket: "61–90 days", min: 61, max: 90 },
      { bucket: "90+ days", min: 91, max: Infinity },
    ];

    const aging = buckets.map(({ bucket, min, max }) => {
      const rows = invoices.filter(
        (i) => i.agingDays >= min && i.agingDays <= max,
      );
      return {
        bucket,
        amount: rows.reduce((sum, i) => sum + i.pending, 0),
        count: rows.length,
      };
    });

    return settle(
      {
        totalPending,
        totalOutstanding: this.data.customers.reduce(
          (s, c) => s + c.outstanding,
          0,
        ),
        overdue: overdueInvoices.reduce((sum, i) => sum + i.pending, 0),
        over90Days: over90.reduce((sum, i) => sum + i.pending, 0),
        followUpCount: overdueInvoices.length,
        aging,
      },
      this.latency,
    );
  }

  async listInvoices(
    query: ListQuery & { customerId?: string; overdueOnly?: boolean } = {},
  ): Promise<Page<Invoice>> {
    let rows = [...this.data.invoices];
    if (query.customerId)
      rows = rows.filter((i) => i.customerId === query.customerId);
    if (query.overdueOnly) rows = rows.filter((i) => i.agingDays > 0);
    if (query.search) {
      rows = rows.filter((i) =>
        matches([i.invoiceNumber, i.customerName], query.search!),
      );
    }
    rows.sort((a, b) => b.agingDays - a.agingDays);
    return settle(paginate(rows, query), this.latency);
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    return settle(
      this.data.invoices.find((i) => i.id === id) ?? null,
      this.latency,
    );
  }

  async listPaymentRecords(
    query: ListQuery & { customerId?: string; invoiceId?: string } = {},
  ): Promise<Page<PaymentRecord>> {
    let rows = [...this.data.payments];
    if (query.customerId)
      rows = rows.filter((p) => p.customerId === query.customerId);
    if (query.invoiceId)
      rows = rows.filter((p) => p.invoiceId === query.invoiceId);
    rows.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    return settle(paginate(rows, query), this.latency);
  }

  // ---- Activity & notifications ------------------------------------------

  async listActivities(
    query: ListQuery & {
      leadId?: string;
      customerId?: string;
      kind?: string;
    } = {},
  ): Promise<Page<Activity>> {
    let rows = [...this.data.activities];
    if (query.leadId) rows = rows.filter((a) => a.leadId === query.leadId);
    if (query.customerId)
      rows = rows.filter((a) => a.customerId === query.customerId);
    if (query.kind) rows = rows.filter((a) => a.kind === query.kind);
    if (query.search)
      rows = rows.filter((a) => matches([a.summary, a.kind], query.search!));
    return settle(paginate(rows, query), this.latency);
  }

  async getActivity(id: string): Promise<Activity | null> {
    return settle(
      this.data.activities.find((a) => a.id === id) ?? null,
      this.latency,
    );
  }

  async listNotifications(
    query: ListQuery = {},
  ): Promise<Page<AppNotification>> {
    return settle(paginate([...this.data.notifications], query), this.latency);
  }

  async markNotificationRead(id: string): Promise<void> {
    const row = this.data.notifications.find((n) => n.id === id);
    if (row) row.read = true;
    await settle(undefined, this.latency);
  }

  // ---- Writes -------------------------------------------------------------

  async createCustomer(
    input: Partial<Customer> & { name: string },
  ): Promise<Customer> {
    const id = this.nextId("cust");
    const nowIso = new Date().toISOString();
    const row: Customer = {
      id,
      name: input.name,
      division: input.division ?? null,
      category: input.category ?? null,
      type: input.type ?? "New",
      industryId: input.industryId ?? null,
      industryName: input.industryName ?? null,
      subIndustry: input.subIndustry ?? null,
      area: input.area ?? null,
      paymentTerms: input.paymentTerms ?? null,
      payZone: input.payZone ?? "GreenZone",
      outstanding: 0,
      active: true,
      salespersonId: this.data.user.id,
      salespersonName: this.data.user.name,
      collectorId: null,
      collectorName: null,
      contacts: input.contacts ?? [],
      primaryContactName: input.contacts?.[0]?.name ?? null,
      primaryContactPhone: input.contacts?.[0]?.phone ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      locationAccuracyM: input.locationAccuracyM ?? null,
      locationPinnedAt: input.latitude != null ? nowIso : null,
      locationPinnedById: input.latitude != null ? this.data.user.id : null,
      locationPinnedByName: input.latitude != null ? this.data.user.name : null,
      locationUrl:
        input.latitude != null && input.longitude != null
          ? `https://www.google.com/maps?q=${input.latitude},${input.longitude}`
          : null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.data.customers.unshift(row);
    this.data.contactsByCustomer[id] = row.contacts;
    return settle(row, this.latency);
  }

  async updateCustomer(
    id: string,
    input: Partial<Customer>,
  ): Promise<Customer> {
    const row = this.data.customers.find((c) => c.id === id);
    if (!row) throw new Error(`No customer ${id}`);
    Object.assign(row, input, { updatedAt: new Date().toISOString() });
    return settle(row, this.latency);
  }

  async createLead(
    input: Partial<Lead> & { customerName: string },
  ): Promise<Lead> {
    const nowIso = new Date().toISOString();
    const products = input.products ?? [];
    const row: Lead = {
      id: this.nextId("lead"),
      customerName: input.customerName,
      division: input.division ?? null,
      tier: input.tier ?? null,
      type: input.type ?? null,
      salespersonId: this.data.user.id,
      salespersonName: this.data.user.name,
      stage: input.stage ?? "NewEnquiries",
      industryId: input.industryId ?? null,
      industryName: input.industryName ?? null,
      subIndustry: input.subIndustry ?? null,
      area: input.area ?? null,
      address: input.address ?? null,
      contacts: input.contacts ?? [],
      contactName: input.contacts?.[0]?.name ?? input.contactName ?? null,
      phone: input.contacts?.[0]?.phone ?? input.phone ?? null,
      nextFollowUp: input.nextFollowUp ?? null,
      expClose: input.expClose ?? null,
      stageUpdatedAt: nowIso,
      products,
      totalValue:
        input.totalValue ??
        products.reduce((sum, p) => sum + (p.value ?? 0), 0),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.data.leads.unshift(row);
    return settle(row, this.latency);
  }

  async updateLead(id: string, input: Partial<Lead>): Promise<Lead> {
    const row = this.data.leads.find((l) => l.id === id);
    if (!row) throw new Error(`No lead ${id}`);
    Object.assign(row, input, { updatedAt: new Date().toISOString() });
    return settle(row, this.latency);
  }

  async changeLeadStage(id: string, stage: DealStageValue): Promise<Lead> {
    const nowIso = new Date().toISOString();
    const row = await this.updateLead(id, { stage, stageUpdatedAt: nowIso });
    this.data.activities.unshift({
      id: this.nextId("act"),
      leadId: id,
      customerId:
        this.data.customers.find((c) => c.name === row.customerName)?.id ?? "",
      kind: "Stage change",
      summary: `Moved to ${stage}`,
      at: nowIso,
      actorName: this.data.user.name,
    });
    return row;
  }

  async createFollowUp(
    input: Omit<FollowUp, "id" | "createdAt" | "completedAt">,
  ): Promise<FollowUp> {
    const row: FollowUp = {
      ...input,
      id: this.nextId("followup"),
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.data.followUps.unshift(row);
    return settle(row, this.latency);
  }

  async completeFollowUp(id: string, notes?: string): Promise<FollowUp> {
    const row = this.data.followUps.find((f) => f.id === id);
    if (!row) throw new Error(`No follow-up ${id}`);
    row.completedAt = new Date().toISOString();
    if (notes) row.notes = notes;
    return settle(row, this.latency);
  }

  async createOrder(input: {
    customerId: string;
    lines: { productId: string; qty: number; price: number }[];
    expectedDeliveryAt?: string | null;
    deliveryAddress?: string | null;
    paymentTerms?: Order["paymentTerms"];
  }): Promise<Order> {
    const customer = this.data.customers.find((c) => c.id === input.customerId);
    if (!customer) throw new Error(`No customer ${input.customerId}`);

    const lines = input.lines.map((line, i) => {
      const product = this.data.products.find((p) => p.id === line.productId);
      return {
        id: `${this.nextId("line")}-${i}`,
        productId: line.productId,
        productName: product?.name ?? "Unknown product",
        principal: product?.principal ?? "",
        qty: line.qty,
        unit: product?.unit ?? "",
        price: line.price,
        value: line.qty * line.price,
      };
    });
    const subtotal = lines.reduce((sum, l) => sum + l.value, 0);
    const taxRate = 18;
    const tax = Math.round((subtotal * taxRate) / 100);
    const nowIso = new Date().toISOString();

    const row: Order = {
      id: this.nextId("order"),
      soNumber: `SO-${String(2600 + this.data.orders.length + 1)}`,
      customerId: customer.id,
      customerName: customer.name,
      status: "Created",
      lines,
      subtotal,
      taxRate,
      tax,
      total: subtotal + tax,
      paymentTerms: input.paymentTerms ?? customer.paymentTerms,
      issuedAt: nowIso,
      expectedDeliveryAt: input.expectedDeliveryAt ?? null,
      deliveryAddress: input.deliveryAddress ?? customer.area,
      statusHistory: [{ status: "Created", at: nowIso }],
    };
    this.data.orders.unshift(row);
    return settle(row, this.latency);
  }

  async createMapping(input: {
    customerId: string;
    productId: string;
    agreedPrice: number | null;
  }): Promise<Mapping> {
    const customer = this.data.customers.find((c) => c.id === input.customerId);
    const product = this.data.products.find((p) => p.id === input.productId);
    if (!customer || !product) throw new Error("Unknown customer or product");

    const row: Mapping = {
      id: this.nextId("map"),
      customerId: customer.id,
      customerName: customer.name,
      productId: product.id,
      productName: product.name,
      principal: product.principal,
      listPrice: product.listPrice,
      agreedPrice: input.agreedPrice,
      ownerId: this.data.user.id,
      ownerName: this.data.user.name,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.data.mappings.unshift(row);
    return settle(row, this.latency);
  }

  async updateMapping(
    id: string,
    input: { agreedPrice: number | null },
  ): Promise<Mapping> {
    const row = this.data.mappings.find((m) => m.id === id);
    if (!row) throw new Error(`No mapping ${id}`);
    row.agreedPrice = input.agreedPrice;
    return settle(row, this.latency);
  }

  async deleteMapping(id: string): Promise<void> {
    const row = this.data.mappings.find((m) => m.id === id);
    if (row) row.active = false;
    await settle(undefined, this.latency);
  }

  async updateProjection(
    id: string,
    input: Partial<Projection>,
  ): Promise<Projection> {
    const row = this.data.projections.find((p) => p.id === id);
    if (!row) throw new Error(`No projection ${id}`);
    // A locked period is read-only. The screens hide the controls, but the
    // source refuses too, so a stale screen cannot write through.
    if (row.locked)
      throw new Error("This period is locked and cannot be edited.");
    Object.assign(row, input);
    row.projectedValue = row.projectedQty * row.price;
    row.achievedValue = row.achievedQty * row.price;
    return settle(row, this.latency);
  }

  async deleteProjection(id: string): Promise<void> {
    const row = this.data.projections.find((p) => p.id === id);
    if (!row) return;
    if (row.locked)
      throw new Error("This period is locked and cannot be edited.");
    this.data.projections = this.data.projections.filter((p) => p.id !== id);
    await settle(undefined, this.latency);
  }
}

/** Convenience for tests and for the provider. */
export function createSyntheticSource(
  options?: SyntheticSourceOptions,
): DataSource & MutableDataSource {
  return new SyntheticSource(options);
}
