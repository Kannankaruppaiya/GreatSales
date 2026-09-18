/**
 * The synthetic dataset.
 *
 * Every row is generated at runtime from a fixed seed and the word pools in
 * `./vocabulary`. There is no literal customer, opportunity, order or payment
 * anywhere in this app — that was the specific failure of the previous mobile
 * rewrite, where invented businesses and figures were typed straight into the
 * screens and later read as if they were the tenant's own data.
 *
 * Rows are built to the same `@greatsales/shared` contracts the API returns, so
 * swapping this for `ApiSource` changes where the rows come from and nothing
 * else.
 */
import type {
  ContactRow,
  CustomerCategoryValue,
  CustomerRow,
  DealStageValue,
  LeadProductRow,
  LeadRow,
  OrderStatusValue,
  PayZoneValue,
  PaymentTermsValue,
} from "@greatsales/shared";
import {
  CUSTOMER_CATEGORY_VALUES,
  ORDER_STATUS_VALUES,
  PAYMENT_TERMS_VALUES,
  PAY_ZONE_VALUES,
} from "@greatsales/shared";

import { Rng } from "./random";
import {
  AREAS,
  COMPANY_PREFIXES,
  COMPANY_SUFFIXES,
  COMPANY_TRADES,
  DESIGNATIONS,
  FOLLOW_UP_PURPOSES,
  INDUSTRIES,
  OPPORTUNITY_THEMES,
  PACK_SIZES,
  PERSON_FIRST,
  PERSON_LAST,
  PRINCIPALS,
  PRODUCT_GRADES,
  PRODUCT_LINES,
  REMARK_NOTES,
  SUB_INDUSTRIES,
} from "./vocabulary";
import { DEAL_STAGE_LABELS } from "@/lib/stages";

/** Default seed. Change it to shuffle the whole dataset coherently. */
export const DEFAULT_SEED = "greatsales-mobilev2";

/** The signed-in salesperson the synthetic dataset is generated around. */
export interface SyntheticUser {
  id: string;
  name: string;
  role: "sales";
  email: string;
  phone: string;
}

export interface SyntheticFollowUp {
  id: string;
  leadId: string | null;
  customerId: string;
  customerName: string;
  purpose: string;
  notes: string | null;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface SyntheticOrderLine {
  id: string;
  productId: string;
  productName: string;
  principal: string;
  qty: number;
  unit: string;
  price: number;
  value: number;
}

export interface SyntheticOrder {
  id: string;
  soNumber: string;
  customerId: string;
  customerName: string;
  status: OrderStatusValue;
  lines: SyntheticOrderLine[];
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  paymentTerms: PaymentTermsValue | null;
  issuedAt: string;
  expectedDeliveryAt: string | null;
  deliveryAddress: string | null;
  /** Status → timestamp, in the order the statuses were reached. */
  statusHistory: { status: OrderStatusValue; at: string }[];
}

export interface SyntheticInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string | null;
  customerId: string;
  customerName: string;
  amount: number;
  received: number;
  pending: number;
  dueAt: string;
  /** Whole days past `dueAt`, or 0 when not yet due. */
  agingDays: number;
  payZone: PayZoneValue | null;
}

export interface SyntheticPaymentRecord {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  reference: string;
  receivedAt: string;
}

export interface SyntheticProduct {
  id: string;
  name: string;
  principal: string;
  unit: string;
  listPrice: number;
}

export interface SyntheticMapping {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  principal: string;
  listPrice: number;
  agreedPrice: number | null;
  ownerId: string;
  ownerName: string;
  active: boolean;
  createdAt: string;
}

export interface SyntheticProjection {
  id: string;
  /** `YYYY-MM`. */
  period: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  principal: string;
  projectedQty: number;
  price: number;
  projectedValue: number;
  achievedQty: number;
  achievedValue: number;
  probability: number;
  status: "Open" | "Committed" | "AtRisk" | "Closed";
  nextFollowUpAt: string | null;
  targetDate: string | null;
  remarks: string | null;
  /** A locked period is read-only: no edit, no delete, no roll-forward. */
  locked: boolean;
}

export interface SyntheticActivity {
  id: string;
  leadId: string | null;
  customerId: string;
  kind: string;
  summary: string;
  at: string;
  actorName: string;
}

export interface SyntheticNotification {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  kind: "followup" | "lead" | "order" | "system";
}

export interface SyntheticDataset {
  seed: string;
  /** The instant the dataset is generated around; all dates are relative to it. */
  now: Date;
  user: SyntheticUser;
  customers: CustomerRow[];
  contactsByCustomer: Record<string, ContactRow[]>;
  leads: LeadRow[];
  followUps: SyntheticFollowUp[];
  orders: SyntheticOrder[];
  invoices: SyntheticInvoice[];
  payments: SyntheticPaymentRecord[];
  products: SyntheticProduct[];
  mappings: SyntheticMapping[];
  projections: SyntheticProjection[];
  activities: SyntheticActivity[];
  notifications: SyntheticNotification[];
}

const DAY_MS = 86_400_000;

function iso(base: Date, dayOffset: number, hour = 10, minute = 0): string {
  const d = new Date(base.getTime() + dayOffset * DAY_MS);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function period(base: Date, monthOffset: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function companyName(rng: Rng, index: number): string {
  // The index keeps names unique without a retry loop.
  return `${rng.pick(COMPANY_PREFIXES)} ${rng.pick(COMPANY_TRADES)}${rng.pick(
    COMPANY_SUFFIXES,
  )} ${index + 1}`;
}

function personName(rng: Rng): string {
  return `${rng.pick(PERSON_FIRST)} ${rng.pick(PERSON_LAST)}`;
}

/** Placeholder numbers in the reserved 99999-xxxxx space — never dialable. */
function phone(rng: Rng): string {
  return `99999 ${String(rng.int(10000, 99999))}`;
}

export interface GenerateOptions {
  seed?: string;
  /** The instant to generate around. Defaults to now. */
  now?: Date;
  customerCount?: number;
  leadCount?: number;
}

export function generateDataset(
  options: GenerateOptions = {},
): SyntheticDataset {
  const seed = options.seed ?? DEFAULT_SEED;
  const now = options.now ?? new Date();
  const rng = new Rng(seed);

  const customerCount = options.customerCount ?? 24;
  const leadCount = options.leadCount ?? 32;

  const user: SyntheticUser = {
    id: "user-synthetic-1",
    name: "Sample Salesperson",
    role: "sales",
    email: "sample.salesperson@example.invalid",
    phone: phone(rng),
  };

  // ---- Products -----------------------------------------------------------
  const products: SyntheticProduct[] = [];
  for (let i = 0; i < 18; i += 1) {
    const principal = rng.pick(PRINCIPALS);
    const name = `${rng.pick(PRODUCT_LINES)} ${rng.pick(PRODUCT_GRADES)}`;
    products.push({
      id: `prod-${i + 1}`,
      name,
      principal,
      unit: rng.pick(PACK_SIZES),
      listPrice: rng.int(180, 4800),
    });
  }

  // ---- Customers ----------------------------------------------------------
  const customers: CustomerRow[] = [];
  const contactsByCustomer: Record<string, ContactRow[]> = {};

  for (let i = 0; i < customerCount; i += 1) {
    const id = `cust-${i + 1}`;
    const name = companyName(rng, i);
    const contactCount = rng.weighted([
      [1, 6],
      [2, 3],
      [3, 1],
    ]);
    const contacts: ContactRow[] = Array.from(
      { length: contactCount },
      (_, c) => {
        const contactPhone = phone(rng);
        return {
          id: `${id}-contact-${c + 1}`,
          name: personName(rng),
          designation: rng.pick(DESIGNATIONS),
          phone: contactPhone,
          whatsapp: contactPhone,
          sameAsMobile: true,
          email: null,
          isPrimary: c === 0,
        } satisfies ContactRow;
      },
    );
    contactsByCustomer[id] = contacts;

    // Outstanding is zero for most accounts; the ones that carry it drive the
    // collections screens, so give that minority a realistic spread.
    const carriesOutstanding = rng.chance(0.55);
    const outstanding = carriesOutstanding ? rng.int(12_000, 940_000) : 0;

    customers.push({
      id,
      name,
      division: rng.pick(["LUB", "WES"] as const),
      category: rng.pick(CUSTOMER_CATEGORY_VALUES) as CustomerCategoryValue,
      type: rng.chance(0.75) ? "Existing" : "New",
      industryId: `ind-${rng.int(1, INDUSTRIES.length)}`,
      industryName: rng.pick(INDUSTRIES),
      subIndustry: rng.pick(SUB_INDUSTRIES),
      area: rng.pick(AREAS),
      paymentTerms: rng.pick(PAYMENT_TERMS_VALUES) as PaymentTermsValue,
      payZone: carriesOutstanding
        ? (rng.weighted([
            ["GreenZone", 5],
            ["YellowZone", 3],
            ["RedZone", 2],
          ] as const) as PayZoneValue)
        : ("GreenZone" as PayZoneValue),
      outstanding,
      active: true,
      salespersonId: user.id,
      salespersonName: user.name,
      collectorId: null,
      collectorName: null,
      contacts,
      primaryContactName: contacts[0]?.name ?? null,
      primaryContactPhone: contacts[0]?.phone ?? null,
      // Coordinates sit in a generic band so the map has spread without
      // claiming any real address.
      latitude: rng.float(12.8, 13.2, 5),
      longitude: rng.float(79.9, 80.3, 5),
      locationAccuracyM: rng.int(5, 40),
      locationPinnedAt: iso(now, -rng.int(20, 300)),
      locationPinnedById: user.id,
      locationPinnedByName: user.name,
      locationUrl: null,
      createdAt: iso(now, -rng.int(120, 900)),
      updatedAt: iso(now, -rng.int(0, 60)),
    });
  }

  // Fill in the maps link now that both coordinates exist.
  for (const c of customers) {
    if (c.latitude != null && c.longitude != null) {
      c.locationUrl = `https://www.google.com/maps?q=${c.latitude},${c.longitude}`;
    }
  }

  // ---- Leads / opportunities ---------------------------------------------
  const leads: LeadRow[] = [];
  for (let i = 0; i < leadCount; i += 1) {
    const customer = rng.pick(customers);
    const contacts = contactsByCustomer[customer.id] ?? [];
    const lineCount = rng.int(1, 3);
    const lines: LeadProductRow[] = rng
      .sample(products, lineCount)
      .map((product, li) => {
        const qty = rng.int(5, 260);
        const price = Math.round(product.listPrice * rng.float(0.86, 1.04, 3));
        return {
          id: `lead-${i + 1}-line-${li + 1}`,
          principalId: product.principal,
          productId: product.id,
          productName: product.name,
          brand: product.principal,
          qty,
          unit: product.unit,
          price,
          value: qty * price,
        } satisfies LeadProductRow;
      });
    const totalValue = lines.reduce((sum, l) => sum + (l.value ?? 0), 0);

    // Weighted so the pipeline looks like a pipeline: many early, few closed.
    const stage = rng.weighted([
      ["NewEnquiries", 5],
      ["NeedsAnalysis", 4],
      ["TrialsAndSampleTests", 3],
      ["ProposalsAndPriceQuote", 4],
      ["NegotiationOralConfirmation", 3],
      ["ClosedWon", 2],
      ["ClosedLost", 1],
      ["NoRequirementOrCold", 1],
    ] as const) as DealStageValue;

    const isOpen = !["ClosedWon", "ClosedLost", "NoRequirementOrCold"].includes(
      stage,
    );

    leads.push({
      id: `lead-${i + 1}`,
      customerName: customer.name,
      division: customer.division,
      tier: customer.category,
      type: customer.type,
      salespersonId: user.id,
      salespersonName: user.name,
      stage,
      industryId: customer.industryId,
      industryName: customer.industryName,
      subIndustry: customer.subIndustry,
      area: customer.area,
      address: null,
      contacts,
      contactName: contacts[0]?.name ?? null,
      phone: contacts[0]?.phone ?? null,
      nextFollowUp: isOpen ? iso(now, rng.int(-6, 21), rng.int(9, 18)) : null,
      expClose: isOpen ? iso(now, rng.int(5, 90)) : null,
      stageUpdatedAt: iso(now, -rng.int(0, 45)),
      products: lines,
      totalValue,
      createdAt: iso(now, -rng.int(10, 240)),
      updatedAt: iso(now, -rng.int(0, 20)),
    });
  }

  // ---- Follow-ups ---------------------------------------------------------
  // Spread across overdue / today / upcoming so the Home and Follow-up screens
  // each have something to show without any of them being hand-placed.
  const followUps: SyntheticFollowUp[] = [];
  const openLeads = leads.filter((l) => l.nextFollowUp != null);
  openLeads.forEach((lead, i) => {
    const customer = customers.find((c) => c.name === lead.customerName);
    if (!customer) return;
    const bucket = rng.weighted([
      ["overdue", 2],
      ["today", 3],
      ["upcoming", 5],
    ] as const);
    const dayOffset =
      bucket === "overdue"
        ? -rng.int(1, 12)
        : bucket === "today"
          ? 0
          : rng.int(1, 18);
    followUps.push({
      id: `followup-${i + 1}`,
      leadId: lead.id,
      customerId: customer.id,
      customerName: customer.name,
      purpose: rng.pick(FOLLOW_UP_PURPOSES),
      notes: rng.chance(0.4) ? rng.pick(REMARK_NOTES) : null,
      dueAt: iso(now, dayOffset, rng.int(9, 18), rng.pick([0, 30])),
      completedAt: null,
      createdAt: iso(now, -rng.int(1, 40)),
    });
  });
  // A tail of completed ones, so history screens are not empty.
  for (let i = 0; i < 14; i += 1) {
    const customer = rng.pick(customers);
    const completedOffset = -rng.int(2, 60);
    followUps.push({
      id: `followup-done-${i + 1}`,
      leadId: null,
      customerId: customer.id,
      customerName: customer.name,
      purpose: rng.pick(FOLLOW_UP_PURPOSES),
      notes: rng.chance(0.5) ? rng.pick(REMARK_NOTES) : null,
      dueAt: iso(now, completedOffset),
      completedAt: iso(now, completedOffset, rng.int(11, 19)),
      createdAt: iso(now, completedOffset - rng.int(1, 14)),
    });
  }

  // ---- Orders -------------------------------------------------------------
  const orders: SyntheticOrder[] = [];
  const statusOrder = ORDER_STATUS_VALUES.filter((s) => s !== "Cancelled");
  for (let i = 0; i < 26; i += 1) {
    const customer = rng.pick(customers);
    const lineCount = rng.int(1, 4);
    const lines: SyntheticOrderLine[] = rng
      .sample(products, lineCount)
      .map((product, li) => {
        const qty = rng.int(4, 180);
        const price = Math.round(product.listPrice * rng.float(0.88, 1.02, 3));
        return {
          id: `order-${i + 1}-line-${li + 1}`,
          productId: product.id,
          productName: product.name,
          principal: product.principal,
          qty,
          unit: product.unit,
          price,
          value: qty * price,
        };
      });
    const subtotal = lines.reduce((sum, l) => sum + l.value, 0);
    const taxRate = 18;
    const tax = Math.round((subtotal * taxRate) / 100);

    const cancelled = rng.chance(0.07);
    const reachedIndex = cancelled ? 0 : rng.int(0, statusOrder.length - 1);
    const status: OrderStatusValue = cancelled
      ? "Cancelled"
      : (statusOrder[reachedIndex] as OrderStatusValue);

    const issuedOffset = -rng.int(1, 120);
    const statusHistory = statusOrder
      .slice(0, reachedIndex + 1)
      .map((s, si) => ({
        status: s as OrderStatusValue,
        at: iso(now, issuedOffset + si * rng.int(1, 4), rng.int(9, 18)),
      }));
    if (cancelled) {
      statusHistory.push({
        status: "Cancelled",
        at: iso(now, issuedOffset + 1),
      });
    }

    orders.push({
      id: `order-${i + 1}`,
      soNumber: `SO-${String(2600 + i)}`,
      customerId: customer.id,
      customerName: customer.name,
      status,
      lines,
      subtotal,
      taxRate,
      tax,
      total: subtotal + tax,
      paymentTerms: customer.paymentTerms,
      issuedAt: iso(now, issuedOffset),
      expectedDeliveryAt: iso(now, issuedOffset + rng.int(3, 21)),
      deliveryAddress: `${customer.area}, ${customer.name}`,
      statusHistory,
    });
  }

  // ---- Invoices & payments (read-only for a salesperson) ------------------
  const invoices: SyntheticInvoice[] = [];
  const payments: SyntheticPaymentRecord[] = [];
  let invoiceSeq = 0;

  for (const customer of customers) {
    if (customer.outstanding <= 0) continue;
    const invoiceCount = rng.int(1, 4);
    // Split the account's outstanding across its invoices so the customer-level
    // total and the invoice list always agree.
    let remaining = customer.outstanding;
    for (let i = 0; i < invoiceCount; i += 1) {
      invoiceSeq += 1;
      const isLast = i === invoiceCount - 1;
      const pending = isLast
        ? remaining
        : Math.max(1, Math.round(remaining * rng.float(0.2, 0.6, 3)));
      remaining -= pending;

      const amount = Math.round(pending * rng.float(1.0, 1.8, 3));
      const received = amount - pending;
      const dueOffset = -rng.int(-25, 130);
      const agingDays = dueOffset < 0 ? -dueOffset : 0;

      const invoice: SyntheticInvoice = {
        id: `inv-${invoiceSeq}`,
        invoiceNumber: `INV-${String(9400 + invoiceSeq)}`,
        orderId: orders.find((o) => o.customerId === customer.id)?.id ?? null,
        customerId: customer.id,
        customerName: customer.name,
        amount,
        received,
        pending,
        dueAt: iso(now, dueOffset),
        agingDays,
        payZone: customer.payZone,
      };
      invoices.push(invoice);

      if (received > 0) {
        payments.push({
          id: `pay-${invoiceSeq}`,
          invoiceId: invoice.id,
          customerId: customer.id,
          amount: received,
          reference: `RCPT-${String(7100 + invoiceSeq)}`,
          receivedAt: iso(now, dueOffset - rng.int(0, 20)),
        });
      }
      if (remaining <= 0) break;
    }
  }

  // ---- Mappings -----------------------------------------------------------
  const mappings: SyntheticMapping[] = [];
  let mappingSeq = 0;
  for (const customer of customers) {
    const mapped = rng.sample(products, rng.int(1, 5));
    for (const product of mapped) {
      mappingSeq += 1;
      // Some mappings deliberately carry no agreed price — the "unpriced
      // mappings" filter on 06A needs rows to find.
      const hasAgreed = rng.chance(0.7);
      mappings.push({
        id: `map-${mappingSeq}`,
        customerId: customer.id,
        customerName: customer.name,
        productId: product.id,
        productName: product.name,
        principal: product.principal,
        listPrice: product.listPrice,
        agreedPrice: hasAgreed
          ? Math.round(product.listPrice * rng.float(0.82, 1.0, 3))
          : null,
        ownerId: user.id,
        ownerName: user.name,
        active: true,
        createdAt: iso(now, -rng.int(10, 400)),
      });
    }
  }

  // ---- Projections --------------------------------------------------------
  const projections: SyntheticProjection[] = [];
  let projectionSeq = 0;
  // Previous month is locked, current and next are open — that gives 07L both
  // of its states without a special case in the screen.
  for (const monthOffset of [-1, 0, 1]) {
    const p = period(now, monthOffset);
    const locked = monthOffset < 0;
    for (const mapping of rng.sample(mappings, 18)) {
      projectionSeq += 1;
      const price = mapping.agreedPrice ?? mapping.listPrice;
      const projectedQty = rng.int(10, 320);
      const achievedQty =
        monthOffset > 0 ? 0 : Math.round(projectedQty * rng.float(0, 1.15, 2));
      projections.push({
        id: `proj-${projectionSeq}`,
        period: p,
        customerId: mapping.customerId,
        customerName: mapping.customerName,
        productId: mapping.productId,
        productName: mapping.productName,
        principal: mapping.principal,
        projectedQty,
        price,
        projectedValue: projectedQty * price,
        achievedQty,
        achievedValue: achievedQty * price,
        probability: rng.pick([20, 40, 50, 60, 75, 90]),
        status: rng.pick(["Open", "Committed", "AtRisk", "Closed"] as const),
        nextFollowUpAt: rng.chance(0.5) ? iso(now, rng.int(1, 20)) : null,
        targetDate: rng.chance(0.6) ? iso(now, rng.int(3, 45)) : null,
        remarks: rng.chance(0.35) ? rng.pick(REMARK_NOTES) : null,
        locked,
      });
    }
  }

  // ---- Activity timeline --------------------------------------------------
  const activities: SyntheticActivity[] = [];
  let activitySeq = 0;
  for (const lead of leads) {
    const customer = customers.find((c) => c.name === lead.customerName);
    if (!customer) continue;
    const count = rng.int(2, 7);
    for (let i = 0; i < count; i += 1) {
      activitySeq += 1;
      const kind = rng.pick([
        "Call",
        "Visit",
        "Note",
        "Stage change",
        "Quotation",
      ] as const);
      activities.push({
        id: `act-${activitySeq}`,
        leadId: lead.id,
        customerId: customer.id,
        kind,
        summary:
          kind === "Note"
            ? rng.pick(REMARK_NOTES)
            : kind === "Stage change"
              ? `Moved to ${DEAL_STAGE_LABELS[lead.stage]}`
              : rng.pick(FOLLOW_UP_PURPOSES),
        at: iso(
          now,
          -rng.int(0, 90),
          rng.int(9, 19),
          rng.pick([0, 15, 30, 45]),
        ),
        actorName: user.name,
      });
    }
  }
  activities.sort((a, b) => b.at.localeCompare(a.at));

  // ---- Notifications ------------------------------------------------------
  const notifications: SyntheticNotification[] = [];
  for (let i = 0; i < 12; i += 1) {
    const kind = rng.pick(["followup", "lead", "order", "system"] as const);
    const customer = rng.pick(customers);
    notifications.push({
      id: `notif-${i + 1}`,
      kind,
      title:
        kind === "followup"
          ? "Follow-up due"
          : kind === "lead"
            ? "Opportunity updated"
            : kind === "order"
              ? "Order status changed"
              : "App update available",
      body:
        kind === "system"
          ? "A newer version of GreatSales is available."
          : `${customer.name} — ${rng.pick(OPPORTUNITY_THEMES)}`,
      at: iso(now, -rng.int(0, 14), rng.int(8, 20)),
      read: rng.chance(0.55),
    });
  }
  notifications.sort((a, b) => b.at.localeCompare(a.at));

  return {
    seed,
    now,
    user,
    customers,
    contactsByCustomer,
    leads,
    followUps,
    orders,
    invoices,
    payments,
    products,
    mappings,
    projections,
    activities,
    notifications,
  };
}
