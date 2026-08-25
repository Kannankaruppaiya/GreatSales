import {
  CUSTOMER_TIERS,
  DEAL_STAGES,
  DIVISIONS,
  INDUSTRIAL_AREAS,
  PAY_ZONES,
  PROJ_STATUSES,
  SO_STATUSES,
} from "@/data/constants";
import type {
  Customer,
  Lead,
  Payment,
  Principal,
  Product,
  Projection,
  SalesOrder,
  User,
} from "@/data/types";

/**
 * Synthetic fixtures for the client-side `trackerStore`.
 *
 * This replaces `pocSeedData.ts`, which held 417 REAL customers, 141 real
 * payments and named contacts extracted verbatim from a live system — and which
 * shipped in the production bundle, because `trackerStore` is reachable from the
 * app. See checklists/07-SECURITY.md G.3.9.
 *
 * The store it feeds is a mock either way: the management feature reads it
 * instead of an API (roadmap F14, tracked as unfinished). Swapping real records
 * for invented ones therefore changes no truth claim — it removes real people's
 * names and numbers from a public artifact while the screen keeps behaving
 * exactly as it did.
 *
 * Two properties matter:
 *   - DETERMINISTIC. No `Math.random()`, so a reload shows the same numbers and
 *     a screenshot stays reproducible.
 *   - SMALL. Roughly 200 rows in total rather than 33,000 lines. Enough for the
 *     screen to look populated, negligible in the bundle.
 *
 * Every name here is obviously invented. If a value in this file ever looks
 * like it belongs to a real company or person, it is a mistake — fix it.
 */

/** Deterministic pseudo-random in [0,1) — a hash, not a generator with state. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Deterministic integer in [0, max). */
function pick(seed: number, max: number): number {
  return Math.floor(rand(seed) * max) % max;
}

const pad = (n: number) => String(n).padStart(3, "0");

/** ISO date `days` from a fixed epoch, so output never depends on "today". */
const EPOCH = Date.UTC(2026, 0, 1);
function dayISO(days: number): string {
  return new Date(EPOCH + days * 86_400_000).toISOString().slice(0, 10);
}

const INDUSTRIES = [
  "Automotive",
  "Textiles",
  "Food Processing",
  "Pharmaceuticals",
  "Heavy Engineering",
  "Packaging",
];

const ROLES = ["admin", "mgmt", "sales", "sales", "sales", "sales"] as const;

export const DEMO_USERS: User[] = Array.from({ length: 6 }, (_, i) => ({
  id: `u${i + 1}`,
  name: `Demo User ${pad(i + 1)}`,
  username: `demo${i + 1}`,
  email: `demo${i + 1}@example.invalid`,
  role: ROLES[i],
  active: true,
  lastLogin: dayISO(200 + i),
}));

const SALES_IDS = DEMO_USERS.filter((u) => u.role === "sales").map((u) => u.id);

export const DEMO_PRINCIPALS: Principal[] = Array.from(
  { length: 6 },
  (_, i) => ({ id: `pr${i + 1}`, name: `Principal Brand ${pad(i + 1)}` }),
);

export const DEMO_PRODUCTS: Product[] = Array.from({ length: 30 }, (_, i) => {
  const principal = DEMO_PRINCIPALS[i % DEMO_PRINCIPALS.length];
  return {
    id: `p${i + 1}`,
    name: `Sample Product ${pad(i + 1)}`,
    sku: `SKU-${pad(i + 1)}`,
    principalId: principal.id,
    principalName: principal.name,
    division: DIVISIONS[i % DIVISIONS.length],
    unit: i % 3 === 0 ? "L" : "KG",
    listPrice: 500 + pick(i + 11, 40) * 25,
    active: true,
  };
});

export const DEMO_CUSTOMERS: Customer[] = Array.from({ length: 40 }, (_, i) => ({
  id: `c${i + 1}`,
  name: `Demo Customer ${pad(i + 1)}`,
  division: DIVISIONS[i % DIVISIONS.length],
  tier: CUSTOMER_TIERS[i % CUSTOMER_TIERS.length],
  type: i % 4 === 0 ? "New" : "Existing",
  industry: INDUSTRIES[i % INDUSTRIES.length],
  area: INDUSTRIAL_AREAS[i % INDUSTRIAL_AREAS.length],
  contactName: `Contact Person ${pad(i + 1)}`,
  // Reserved fictional range — never routes to a real subscriber.
  phone: `+91 99999 ${pad(i + 1)}00`,
  mobile: `+91 99999 ${pad(i + 1)}00`,
  email: `contact${i + 1}@example.invalid`,
  ownerId: SALES_IDS[i % SALES_IDS.length],
  paymentTerms: i % 2 === 0 ? "Net 30" : "Net 45",
  payZone: PAY_ZONES[i % PAY_ZONES.length],
  outstanding: pick(i + 23, 40) * 5_000,
  active: true,
}));

export const DEMO_PROJECTIONS: Projection[] = Array.from(
  { length: 60 },
  (_, i) => {
    const customer = DEMO_CUSTOMERS[i % DEMO_CUSTOMERS.length];
    const product = DEMO_PRODUCTS[i % DEMO_PRODUCTS.length];
    const projected = 10 + pick(i + 31, 40);
    return {
      id: `pj${i + 1}`,
      month: `2026-${String((i % 12) + 1).padStart(2, "0")}`,
      customerId: customer.id,
      productId: product.id,
      ownerId: customer.ownerId,
      projectedQty: projected,
      achievedQty: Math.floor(projected * (pick(i + 41, 100) / 100)),
      price: product.listPrice,
      probability: 10 * (1 + pick(i + 51, 9)),
      status: PROJ_STATUSES[i % PROJ_STATUSES.length],
      nextFollowUp: dayISO(210 + (i % 30)),
      remarks: [],
    };
  },
);

export const DEMO_LEADS: Lead[] = Array.from({ length: 12 }, (_, i) => {
  const product = DEMO_PRODUCTS[i % DEMO_PRODUCTS.length];
  const qty = 5 + pick(i + 61, 20);
  return {
    id: `l${i + 1}`,
    name: `Demo Prospect ${pad(i + 1)}`,
    division: DIVISIONS[i % DIVISIONS.length],
    tier: CUSTOMER_TIERS[i % CUSTOMER_TIERS.length],
    type: "New",
    industry: INDUSTRIES[i % INDUSTRIES.length],
    area: INDUSTRIAL_AREAS[i % INDUSTRIAL_AREAS.length],
    contactName: `Prospect Contact ${pad(i + 1)}`,
    phone: `+91 99999 ${pad(i + 41)}00`,
    email: `prospect${i + 1}@example.invalid`,
    ownerId: SALES_IDS[i % SALES_IDS.length],
    stage: DEAL_STAGES[i % DEAL_STAGES.length],
    products: [
      {
        principalId: product.principalId,
        productId: product.id,
        name: product.name,
        qty,
        unit: product.unit,
        price: product.listPrice,
        value: qty * product.listPrice,
      },
    ],
    nextFollowUp: dayISO(215 + i),
    expClose: dayISO(240 + i * 3),
    createdAt: dayISO(180 + i),
    remarks: [],
  };
});

export const DEMO_ORDERS: SalesOrder[] = Array.from({ length: 8 }, (_, i) => {
  const customer = DEMO_CUSTOMERS[i % DEMO_CUSTOMERS.length];
  const product = DEMO_PRODUCTS[(i * 3) % DEMO_PRODUCTS.length];
  const qty = 4 + pick(i + 71, 16);
  const status = SO_STATUSES[i % SO_STATUSES.length];
  return {
    id: `so${i + 1}`,
    code: `SO-2026-${pad(i + 1)}`,
    customerId: customer.id,
    customerName: customer.name,
    ownerId: customer.ownerId,
    status,
    lines: [
      {
        productId: product.id,
        productName: product.name,
        principalName: product.principalName,
        qty,
        price: product.listPrice,
        unit: product.unit,
      },
    ],
    paymentTerms: customer.paymentTerms,
    expectedDelivery: dayISO(230 + i * 2),
    history: [{ status: SO_STATUSES[0], timestamp: dayISO(200 + i) }],
    createdAt: dayISO(200 + i),
  };
});

export const DEMO_PAYMENTS: Payment[] = Array.from({ length: 25 }, (_, i) => {
  const customer = DEMO_CUSTOMERS[i % DEMO_CUSTOMERS.length];
  const amount = (5 + pick(i + 81, 40)) * 10_000;
  const received = Math.floor(amount * (pick(i + 91, 100) / 100));
  return {
    id: `pay${i + 1}`,
    refNo: `PAY-2026-${pad(i + 1)}`,
    customerId: customer.id,
    customerName: customer.name,
    ownerId: customer.ownerId,
    invoiceNo: `INV-2026-${pad(i + 1)}`,
    invoiceDate: dayISO(150 + i),
    amount,
    received,
    pending: amount - received,
    dueDate: dayISO(180 + i),
    zone: PAY_ZONES[i % PAY_ZONES.length],
    nextFollowUp: dayISO(205 + (i % 25)),
    remarks: [],
  };
});
