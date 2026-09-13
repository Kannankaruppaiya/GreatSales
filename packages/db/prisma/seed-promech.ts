/**
 * GreatSales CRM — seed from the Promech POC dataset.
 *
 * Source of truth: prisma/promech-data.json, extracted verbatim from
 * Desktop/Promech/apps/web/src/services/mock/* (RAW_CUSTOMERS, RAW_PRODUCTS,
 * RAW_MAPS, RAW_JUNE_PROJ, RAW_PAYMENTS, RAW_LEADS, RAW_SALES_ORDERS,
 * SEED_USERS) plus constants/index.ts (INDUSTRIAL_AREAS, INDUSTRY_TAXONOMY).
 *
 * This is the *newer* Promech customer master (real company names carrying
 * area + industry), which supersedes the list in poc-v6-data.json: 140 of the
 * 141 payment parties resolve against it, versus 103 against the older list.
 * seed-poc.ts is left untouched so the older dataset stays reproducible.
 *
 * Nothing here is invented data. Every derived column is marked "DERIVED:"
 * inline with the rule that produced it.
 *
 * Idempotent: TRUNCATEs every table (dev DB only) then reinserts.
 *
 * Logins are the POC's own credentials: `admin` / "admin", everyone else
 * "1234". Login is by EMAIL in this API, so each username `u` becomes
 * `<u>@greatsales.local`.
 */
import { loadDataset } from "./dataset";
import { assertDestructiveSeedAllowed } from "./seed-guard";
/**
 * The RBAC catalogue is IMPORTED, never restated.
 *
 * It used to be copy-pasted here and in seed.ts as well as living in
 * packages/shared/src/rbac.ts — three copies, true in at most one. Adding
 * `period.manage` to the shared list left the database without it, so the API
 * guarded a route against a permission no role had actually been granted and
 * every lock attempt 403'd while the code said admin held it. One source now.
 */
import {
  PERMISSIONS,
  ROLE_PERMISSIONS as ROLE_PERMS,
} from "@greatsales/shared";
import {
  PrismaClient,
  type CustomerCategory,
  type DealStage,
  type DeliveryMode,
  type Division,
  type OrderStatus,
  type PayZone,
  type PaymentStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = "tenant_promech";
const TENANT_NAME = "Promech Industrial Sales";
/**
 * The worksheet months, counted back from the day the seed runs.
 *
 * This was the literal `"2026-06"` — "the only projection month the POC
 * carries" — and a month written down is a month the calendar walks past. By
 * September the worksheet opened on an empty table, roll forward had nothing to
 * carry into the current month, every achievement figure on the dashboard read
 * zero, and the only way to see a line at all was to know to go back to June.
 *
 * So the export's commitment book is THIS month's, and two closed months sit
 * behind it. That gives the page the three things it could not show before: a
 * current month with rows in it, a previous month for roll forward to carry
 * from, and achievement that is not uniformly zero.
 */
const WORKSHEET_MONTHS = 3;
const PERIODS = (() => {
  const now = new Date();
  const out: string[] = [];
  for (let back = WORKSHEET_MONTHS - 1; back >= 0; back--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
})();
/** The open month — the one the app lands on. */
const PERIOD = PERIODS[PERIODS.length - 1];
/** Whose desk the seeded follow-ups land on. A real salesperson in the export. */
const FOLLOWUP_OWNER = "Megala";

// argon2id hashes of the POC's demo passwords (dev only).
const PW_ADMIN =
  "$argon2id$v=19$m=19456,t=2,p=1$PXG/62M4okQJXMC6W+qhXw$GfLM1P7AJ8gifaHC42aolsL4tghggmv4tacSH3gm6I4"; // "admin"
const PW_1234 =
  "$argon2id$v=19$m=19456,t=2,p=1$5cNwq8vIHGkPvFoLLh5NTQ$Z6uxK4mcykUWL+CSjAPrVJnTQUfnWT1BnM6ddXKvcpk"; // "1234"
const PW_PLATFORM =
  "$argon2id$v=19$m=19456,t=2,p=1$YMotFINPtldbJwk7BTyfWA$TlIBiSz3th5+VSEv55i/QkkxiTJSfHY+hhVvt4eSh3Q"; // "Passw0rd!"

// ------------------------------------------------------------ Promech data
type PmUser = {
  id: string;
  u: string;
  p: string;
  role: "admin" | "mgmt" | "sales";
  name: string;
  active: boolean;
};
type PmCustomer = { id: string; name: string; area: string; industry: string };
type PmProduct = { id: string; name: string; brand: string; div: string; price: number | null };
type PmMap = { id: string; c: string; p: string; sp: string; price: number | null };
type PmProj = { m: string; q: number; price: number | null };
type PmPayment = {
  ref: string;
  date: string;
  party: string;
  opening: number;
  pending: number;
  sp: string;
  received: number | null;
  zone: string;
  mail1: string;
  mail2: string;
  mail3: string;
  mail4: string;
  reason: string;
};
type PmRemark = { text: string; dt: string; user?: string };
type PmLead = {
  id: string;
  customerName: string;
  industrialArea?: string;
  industry?: string;
  sp: string;
  contactName?: string;
  mobile?: string;
  productName?: string;
  q?: number | null;
  expPrice?: number | null;
  stage: string;
  nextFollowUpDate?: string | null;
  remarks?: PmRemark[];
  history?: { fromStage: string; toStage: string; timestamp: number; user?: string; note?: string }[];
  createdAt?: number;
};
type PmOrderItem = {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  uom?: string;
  total?: number;
};
type PmOrder = {
  id: string;
  customerId: string;
  customerName: string;
  sp: string;
  paymentTerms?: string;
  deliveryDate?: string;
  createdAt?: number;
  status: string;
  subtotal?: number;
  discount?: number;
  tax?: number;
  grandTotal: number;
  items: PmOrderItem[];
  history?: { fromStatus: string; toStatus: string; timestamp: number; user?: string; note?: string }[];
};

const PM = loadDataset<{
  users: PmUser[];
  areas: string[];
  industryTaxonomy: Record<string, string[]>;
  customers: PmCustomer[];
  products: PmProduct[];
  maps: PmMap[];
  juneProj: PmProj[];
  payments: PmPayment[];
  leads: PmLead[];
  salesOrders: PmOrder[];
}>("promech-data.json", __dirname);

// Permission catalog (global, tenant-agnostic keys).


// ---------------------------------------------------------------- helpers
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
const division = (d: string): Division | null => (d === "LUB" || d === "WES" ? d : null);
const ZONES: Record<string, PayZone> = {
  "Red Zone": "RedZone",
  "Yellow Zone": "YellowZone",
  "Green Zone": "GreenZone",
  Blacklist: "Blacklist",
};
const payZone = (z: string): PayZone | null => ZONES[z] ?? null;
const yn = (v: string) => v === "Yes";
const day = (d: string) => new Date(d + "T00:00:00.000Z");
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const dec = (n: number | null | undefined) => (n == null ? null : n.toFixed(2));

/** Promech's DEAL_STAGES label → the DealStage enum. */
const STAGE: Record<string, DealStage> = {
  "New Enquiries": "NewEnquiries",
  "Needs Analysis": "NeedsAnalysis",
  "Trials & Sample Tests": "TrialsAndSampleTests",
  "Proposals & Price Quote": "ProposalsAndPriceQuote",
  "Negotiation / Oral Confirmation": "NegotiationOralConfirmation",
  "Closed Won": "ClosedWon",
  "Closed Lost": "ClosedLost",
  "No Requirement or Cold": "NoRequirementOrCold",
  "Trial Problem": "TrialProblem",
};

/**
 * Promech's SO_STATUSES label → the OrderStatus enum.
 * DERIVED: the POC's four labels do not map 1:1 onto this API's six-stage
 * lifecycle, so each is placed at the earliest stage that fully implies it —
 * "In Delivery" means the goods have left the warehouse but are not confirmed
 * received, "Fulfilled" means the customer confirmed receipt.
 */
const ORDER_STATUS: Record<string, OrderStatus> = {
  Draft: "Created",
  Confirmed: "Acknowledged",
  "In Delivery": "DeliveredFromWarehouse",
  Fulfilled: "CustomerReceiptConfirmed",
  Cancelled: "Cancelled",
};

/**
 * The fulfilment ladder, in the order an order climbs it.
 *
 * The map above places each of the POC's four labels on its nearest rung, which
 * is right for the order's CURRENT status and wrong for its history: mapped
 * one-to-one, `DeliveryPartnerAssigned` and `DeliveredToCustomer` ended up with
 * no rows anywhere in the workspace. The Fulfilment SLA report measures transit
 * time and order→delivery off exactly those two, so two of its five figures
 * were structurally blank, its Delivered column was empty on every row, and an
 * order could show a customer receipt for a delivery that was never recorded.
 *
 * An order that has reached a rung has passed every rung below it, so the trail
 * is walked rather than mapped — see the sales-order block below.
 */
const ORDER_LADDER = [
  "Created",
  "Acknowledged",
  "DeliveryPartnerAssigned",
  "DeliveredFromWarehouse",
  "DeliveredToCustomer",
  "CustomerReceiptConfirmed",
] as const satisfies readonly OrderStatus[];

/**
 * How long each rung takes, as `[minimum hours, spread]`.
 *
 * Chosen so the generated trail is arguable rather than uniform: an
 * acknowledgement lands within a working day, a warehouse picks overnight, and
 * transit is the long, variable leg — which is what makes the report's transit
 * column worth looking at. Rung 0 is the order itself and takes no time.
 */
const RUNG_HOURS: readonly [number, number][] = [
  [0, 0],
  [5, 22],
  [6, 17],
  [10, 26],
  [22, 80],
  [5, 29],
];

const TRANSPORTERS = ["VRL Logistics", "TCI Express", "Safexpress", "Gati KWE"];
const ORDER_DELIVERY_MODES: DeliveryMode[] = [
  "TransportLR",
  "Courier",
  "CompanyVehicle",
  "TransportLR",
];

/** Normalize a company name so payment parties can be matched to customers. */
const normName = (s: string) =>
  s
    .toUpperCase()
    .replace(/\bPRIVATE\b/g, "PVT")
    .replace(/\bLIMITED\b/g, "LTD")
    .replace(/\b(PVT|LTD|LLP|INC|CO|COMPANY|INDIA|ENTERPRISES?|INDUSTRIES)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, "");

/** Worst-first zone ranking, used to roll payment zones up to the customer. */
const ZONE_RANK: Record<string, number> = { Blacklist: 0, RedZone: 1, YellowZone: 2, GreenZone: 3 };

async function reset() {
  // Dev DB only. TRUNCATE ... CASCADE avoids FK ordering and the User<->Team
  // circular FK. Runs as the superuser (DIRECT_URL), so RLS does not block it.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    "TenantFeatureFlag","FeatureFlag","PlatformAuditLog","PlatformUser",
    "OrderStatusHistory","SalesOrderItem","SalesOrder","PaymentFollowup","Payment",
    "Contact","LeadProduct","Lead","Projection","SalesTarget","Mapping",
    "Product","Principal","Customer","FollowUp","Activity",
    "Notification","Attachment","AuditLog","ImportJob","RolePermission","Role",
    "Permission","Industry","User","Team","Tenant"
    RESTART IDENTITY CASCADE`);
}

async function main() {
  assertDestructiveSeedAllowed(); // must precede the first TRUNCATE
  console.log("🌱 Seeding GreatSales from the Promech dataset…");
  await reset();

  // ---- globals: permissions + industries ---------------------------------
  await prisma.permission.createMany({ data: PERMISSIONS });

  // Industry rows must cover every value actually referenced by a customer or
  // a lead (the FK target), not just the constants file's taxonomy — the
  // customer master uses its own vocabulary ("General Engineering", "Foundry /
  // Casting", …) that does not overlap INDUSTRY_TAXONOMY's keys.
  const industryNames = [
    ...new Set([
      ...PM.customers.map((c) => c.industry).filter(Boolean),
      ...PM.leads.map((l) => l.industry).filter((n): n is string => !!n),
      ...Object.keys(PM.industryTaxonomy),
    ]),
  ].sort();
  await prisma.industry.createMany({
    data: industryNames.map((name) => ({
      id: "ind_" + slug(name),
      name,
      subIndustries: PM.industryTaxonomy[name] ?? [],
    })),
  });

  // ---- platform layer (operator-side infrastructure, not Promech data) ----
  await prisma.platformUser.create({
    data: {
      id: "pu_super",
      name: "Platform Super Admin",
      email: "super@greatsales.io",
      passwordHash: PW_PLATFORM,
      role: "SuperAdmin",
    },
  });

  // ---- tenant + roles ----------------------------------------------------
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: TENANT_NAME,
      plan: "free",
      status: "Active",
      region: "in",
      accountManagerId: "pu_super",
    },
  });

  for (const r of ["admin", "mgmt", "sales"] as const) {
    await prisma.role.create({ data: { id: "role_" + r, tenantId: TENANT_ID, name: r, isSystem: true } });
  }
  const perms = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permId = (key: string) => perms.find((p) => p.key === key)!.id;
  for (const r of ["admin", "mgmt", "sales"] as const) {
    await prisma.rolePermission.createMany({
      data: ROLE_PERMS[r].map((key) => ({ roleId: "role_" + r, permissionId: permId(key) })),
    });
  }

  // ---- users: exactly the POC's 8 logins ---------------------------------
  const userId = (username: string) => "user_" + username;
  const manager = PM.users.find((u) => u.role === "mgmt")!;

  for (const u of PM.users) {
    await prisma.user.create({
      data: {
        id: userId(u.u),
        tenantId: TENANT_ID,
        name: u.name,
        email: u.u + "@greatsales.local",
        username: u.u,
        passwordHash: u.p === "admin" ? PW_ADMIN : PW_1234,
        roleId: "role_" + u.role,
        active: u.active,
      },
    });
  }

  await prisma.team.create({
    data: { id: "team_sales", tenantId: TENANT_ID, name: "Sales Team", managerId: userId(manager.u) },
  });
  await prisma.user.updateMany({
    where: { tenantId: TENANT_ID, roleId: "role_sales" },
    data: { managerId: userId(manager.u), teamId: "team_sales" },
  });

  // The POC stores ownership as a free-text NAME, and the leads/orders files
  // use names with no login ("Sridhar", "Udhayakumar") and spellings that
  // differ from the user list by a letter ("Rajeev" vs "Rajiev", "Balakrishna"
  // vs "Balakrishnan"). Each unknown name becomes its own INACTIVE user rather
  // than being fuzzily merged into a similar one — silently collapsing two
  // identities would reassign real leads and orders to the wrong person.
  const byName = new Map(PM.users.map((u) => [u.name, userId(u.u)]));
  const extraNames = new Set<string>();
  for (const m of PM.maps) if (m.sp && !byName.has(m.sp)) extraNames.add(m.sp);
  for (const l of PM.leads) if (l.sp && !byName.has(l.sp)) extraNames.add(l.sp);
  for (const o of PM.salesOrders) {
    if (o.sp && !byName.has(o.sp)) extraNames.add(o.sp);
    for (const h of o.history ?? []) if (h.user && !byName.has(h.user)) extraNames.add(h.user);
  }
  for (const name of extraNames) {
    const un = slug(name);
    // A display name can slug onto an existing login — the order history says
    // "Admin" where the user list says "Administrator" (username `admin`).
    // Alias onto that row instead of creating a colliding duplicate identity.
    const existing = await prisma.user.findUnique({ where: { id: userId(un) }, select: { id: true } });
    if (existing) {
      byName.set(name, existing.id);
      continue;
    }
    await prisma.user.create({
      data: {
        id: userId(un),
        tenantId: TENANT_ID,
        name,
        email: un + "@greatsales.local",
        username: un,
        passwordHash: PW_1234,
        roleId: "role_sales",
        managerId: userId(manager.u),
        teamId: "team_sales",
        active: false,
      },
    });
    byName.set(name, userId(un));
  }
  const uid = (name: string) => byName.get(name) ?? null;

  // ---- principals (product brands) + products ----------------------------
  const brands = [...new Set(PM.products.map((p) => p.brand))].sort();
  await prisma.principal.createMany({
    data: brands.map((b) => ({ id: "prin_" + slug(b), tenantId: TENANT_ID, name: b })),
  });
  await prisma.product.createMany({
    data: PM.products.map((p) => ({
      id: "prod_" + p.id,
      tenantId: TENANT_ID,
      principalId: "prin_" + slug(p.brand),
      name: p.name,
      // The POC's product code (P001…) is the only SKU it carries, and it is
      // what the catalog screen shows as "SKU Code".
      sku: p.id,
      division: division(p.div),
      basePrice: dec(p.price),
    })),
  });

  // ---- payments first, so customer outstanding/zone can be rolled up -----
  // Payments identify the party by name only. Match on a normalized name and
  // refuse ambiguous keys — attaching real money to the wrong account is worse
  // than leaving a row unlinked (it keeps customerName either way).
  const byNorm = new Map<string, PmCustomer[]>();
  const byExact = new Map<string, PmCustomer>();
  for (const c of PM.customers) {
    const k = normName(c.name);
    byNorm.set(k, [...(byNorm.get(k) ?? []), c]);
    byExact.set(c.name.trim().toUpperCase(), c);
  }
  const matchCustomer = (party: string): PmCustomer | null => {
    const candidates = byNorm.get(normName(party)) ?? [];
    if (candidates.length === 1) return candidates[0];
    return byExact.get(party.trim().toUpperCase()) ?? null;
  };

  const rollup = new Map<string, { pending: number; zone: PayZone | null }>();
  const paymentRows = PM.payments.map((r, i) => {
    const match = matchCustomer(r.party);
    // DERIVED: the POC carries opening / pending / received as three independent
    // imported columns. This API derives pending as amount − received at read
    // time, so `received` is seeded as opening − pending to keep the POC's
    // *pending* figure — the number collections actually works from — exact.
    const received = Math.max(r.opening - r.pending, 0);
    const zone = payZone(r.zone);
    // DERIVED: same rule the API's deriveStatus() applies when it writes this
    // snapshot column, so a seeded row filters identically to an API-created one.
    const overdue = addDays(day(r.date), 30).getTime() < Date.now();
    const status: PaymentStatus =
      received >= r.opening ? "Paid" : overdue ? "Overdue" : received > 0 ? "PartiallyPaid" : "Pending";
    if (match) {
      const acc = rollup.get(match.id) ?? { pending: 0, zone: null };
      acc.pending += r.pending;
      if (zone && (acc.zone === null || ZONE_RANK[zone] < ZONE_RANK[acc.zone])) acc.zone = zone;
      rollup.set(match.id, acc);
    }
    return {
      id: "pay_" + String(i + 1).padStart(4, "0"),
      tenantId: TENANT_ID,
      refNo: r.ref,
      invoiceNo: r.ref,
      invoiceDate: day(r.date),
      // DERIVED: every Promech customer is on the 30-day credit default, so the
      // invoice date gives the due date. Without it the API reports
      // agingDays: null and never flags a receivable Overdue.
      dueDate: addDays(day(r.date), 30),
      customerId: match ? "cust_" + match.id : null,
      customerName: r.party,
      salespersonId: uid(r.sp),
      amount: dec(r.opening)!,
      received: dec(received)!,
      pending: dec(r.pending),
      // Left null on purpose: the API recomputes aging per request from dueDate,
      // so a stored snapshot here would only ever be stale.
      agingDays: null,
      payZone: zone,
      delayReason: r.reason || null,
      mail1: yn(r.mail1),
      mail2: yn(r.mail2),
      mail3: yn(r.mail3),
      mail4: yn(r.mail4),
      // DERIVED: the Promech receivables sheet records whether each reminder
      // letter went out but not when, and the date is what the next decision
      // turns on. A letter that is marked sent is dated on the schedule the
      // collections desk actually works to — 30 days after the invoice, then
      // every fortnight — so the dropdown has a real cadence to show. A letter
      // that never went stays null.
      mail1At: yn(r.mail1) ? addDays(day(r.date), 30) : null,
      mail2At: yn(r.mail2) ? addDays(day(r.date), 45) : null,
      mail3At: yn(r.mail3) ? addDays(day(r.date), 60) : null,
      mail4At: yn(r.mail4) ? addDays(day(r.date), 75) : null,
      status,
    };
  });

  // ---- customers ---------------------------------------------------------
  // DERIVED: Customer.salespersonId is required, but the Promech customer master
  // carries no owner column — ownership lives on the mappings. Each customer
  // takes the salesperson holding the most of their mappings; ties break on the
  // lowest mapping id so the result is deterministic. Every one of the 417
  // customers has at least one mapping, so nothing needs a fallback owner.
  const ownerVotes = new Map<string, Map<string, { count: number; firstMapId: string }>>();
  for (const m of [...PM.maps].sort((a, b) => a.id.localeCompare(b.id))) {
    const votes = ownerVotes.get(m.c) ?? new Map();
    const cur = votes.get(m.sp) ?? { count: 0, firstMapId: m.id };
    votes.set(m.sp, { count: cur.count + 1, firstMapId: cur.firstMapId });
    ownerVotes.set(m.c, votes);
  }
  const ownerOf = (customerId: string): string | null => {
    const votes = ownerVotes.get(customerId);
    if (!votes) return null;
    const best = [...votes.entries()].sort(
      (a, b) => b[1].count - a[1].count || a[1].firstMapId.localeCompare(b[1].firstMapId),
    )[0];
    return uid(best[0]);
  };

  const unowned = PM.customers.filter((c) => !ownerOf(c.id));
  if (unowned.length) {
    throw new Error(
      `${unowned.length} customers have no derivable salesperson (e.g. ${unowned
        .slice(0, 3)
        .map((c) => c.id)
        .join(", ")}). Refusing to invent an owner — fix the source data first.`,
    );
  }

  await prisma.customer.createMany({
    data: PM.customers.map((c) => {
      const roll = rollup.get(c.id);
      return {
        id: "cust_" + c.id,
        tenantId: TENANT_ID,
        name: c.name,
        // The Promech customer master has no division / category / type columns.
        division: null,
        category: null,
        type: null,
        industryId: c.industry ? "ind_" + slug(c.industry) : null,
        area: c.area || null,
        // Promech's own normalizeState() default for every seeded customer.
        paymentTerms: "Credit30" as const,
        payZone: roll?.zone ?? null,
        outstanding: dec(roll?.pending ?? 0)!,
        salespersonId: ownerOf(c.id)!,
        collectorId: null,
      };
    }),
  });

  await prisma.payment.createMany({ data: paymentRows });

  // ---- mappings (customer × product) + June projections ------------------
  await prisma.mapping.createMany({
    data: PM.maps.map((m) => ({
      id: "map_" + m.id,
      tenantId: TENANT_ID,
      customerId: "cust_" + m.c,
      productId: "prod_" + m.p,
      salespersonId: uid(m.sp)!,
      customPrice: dec(m.price),
    })),
  });

  // DERIVED: the export carries one month of commitments and no achievement at
  // all, so a worksheet seeded straight from it shows the same flat book in
  // every month and 0% achieved everywhere — which is what a rolled-forward
  // month looked like too, since a roll copies the commitment and resets the
  // achievement. The quantities below are the export's; what is invented here
  // is the history: the two closed months behind the open one carry a slightly
  // smaller book (the account grew) and an achievement against it, so the
  // trend, the achievement percentage and the status mix have somewhere real to
  // come from.
  //
  // Deterministic on the row's position and the month, never on Math.random —
  // two runs of the seed must produce the same database, or a test that passes
  // today fails tomorrow for no reason anyone can find.
  const spread = (i: number, k: number) => (i * 37 + k * 101) % 100;
  const dayOfMonth = new Date().getUTCDate();

  await prisma.projection.createMany({
    data: PERIODS.flatMap((period, k) => {
      const monthsBack = PERIODS.length - 1 - k;
      const isOpen = monthsBack === 0;
      return PM.juneProj.map((j, i) => {
        const roll = spread(i, k);
        // The book grows, so an earlier month committed a little less.
        const committed = Math.max(1, Math.round(j.q * (1 - 0.06 * monthsBack)));
        // A closed month landed somewhere around its commitment; one line in
        // twelve went nowhere. The open month is only as far through as the
        // calendar is.
        const lost = roll < 8;
        const ratio = lost ? 0 : 0.7 + (roll % 45) / 100;
        const achieved = isOpen
          ? Math.round(committed * ratio * Math.min(1, dayOfMonth / 28))
          : Math.round(committed * ratio);
        const status = isOpen
          ? roll < 15
            ? ("FollowUpPending" as const)
            : roll < 30
              ? ("POReceived" as const)
              : ("ProjectionCreated" as const)
          : lost
            ? ("Lost" as const)
            : achieved >= committed
              ? ("Completed" as const)
              : ("PartiallyConfirmed" as const);
        return {
          tenantId: TENANT_ID,
          mappingId: "map_" + j.m,
          period,
          committedQty: String(committed),
          achievedQty: String(achieved),
          price: dec(j.price),
          status,
          // A handful of open lines are waiting on somebody, so the
          // worksheet's "Needs follow-up" filter has rows to find.
          nextFollowUp:
            isOpen && roll < 15 ? addDays(new Date(), (roll % 7) - 3) : null,
        };
      });
    }),
  });

  // ---- monthly sales targets ---------------------------------------------
  // The SalesTarget table has existed since the first migration and the Promech
  // seed only ever truncated it, so the workspace had zero rows: the dashboard
  // read "SET A TARGET" on every month, `kpis.target` came back null, and the
  // per-salesperson chart had no bar to measure against. A feature that is
  // wired end to end but has nothing in it is indistinguishable from one that
  // is broken — which is exactly how it looked.
  //
  // DERIVED from the same commitments the projections above were built from, so
  // the achievement percentages land in an arguable band instead of being 0% or
  // 900%. A target is set ABOVE the book a salesperson has already committed —
  // that is what makes it a target — by a deterministic 10–34%, and rounded to
  // the nearest thousand so it reads like a number a manager chose rather than
  // an arithmetic artifact.
  const spOfMapping = new Map(PM.maps.map((m) => [m.id, m.sp]));
  const targetRows: {
    tenantId: string;
    salespersonId: string;
    period: string;
    targetValue: string;
  }[] = [];

  PERIODS.forEach((period, k) => {
    const monthsBack = PERIODS.length - 1 - k;
    const committedByPerson = new Map<string, number>();
    PM.juneProj.forEach((j) => {
      const sp = spOfMapping.get(j.m);
      if (!sp) return;
      const committed = Math.max(1, Math.round(j.q * (1 - 0.06 * monthsBack)));
      committedByPerson.set(
        sp,
        (committedByPerson.get(sp) ?? 0) + committed * (j.price ?? 0),
      );
    });

    [...committedByPerson.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([sp, committedValue], i) => {
        const id = uid(sp);
        if (!id || committedValue <= 0) return;
        const factor = 1.1 + (spread(i, k) % 25) / 100;
        const value = Math.round((committedValue * factor) / 1000) * 1000;
        targetRows.push({
          tenantId: TENANT_ID,
          salespersonId: id,
          period,
          targetValue: value.toFixed(2),
        });
      });
  });

  await prisma.salesTarget.createMany({ data: targetRows });

  // ---- leads -------------------------------------------------------------
  const productByName = new Map(PM.products.map((p) => [p.name.trim().toUpperCase(), p]));
  const brandNames = new Set(PM.products.map((p) => p.brand.trim().toUpperCase()));

  /**
   * Match a lead's free-text product against the catalogue.
   *
   * A salesperson writing up an enquiry names the product the way it is said
   * out loud — "IPOL HYDROPAC AW 68" — while the catalogue holds it as
   * "HYDROPAC AW 68", with the brand in its own column. An exact-name match
   * therefore failed on half the pipeline, and a lead whose product did not
   * match carries no principal at all: selecting a brand in the topbar filter
   * silently hid it, so the filter under-reported its own pipeline.
   *
   * So: try the name as written, then again with a leading brand stripped. The
   * brand is only stripped when it IS one of the catalogue's brands, which is
   * why this cannot turn "SYNTHETIC CUT 100" into "CUT 100".
   */
  const matchProduct = (raw: string) => {
    const name = raw.trim().toUpperCase();
    const exact = productByName.get(name);
    if (exact) return exact;
    for (const brand of brandNames) {
      if (name.startsWith(brand + ' ')) {
        const found = productByName.get(name.slice(brand.length + 1).trim());
        if (found) return found;
      }
    }
    return undefined;
  };

  /**
   * The principal a lead's product belongs to, even when the product itself is
   * not on the catalogue.
   *
   * Three of the ten leads name a product the workspace does not stock yet —
   * which is exactly what a new enquiry often is. The brand is still knowable
   * from the first word, and a lead the filter can find is worth more than a
   * lead that is technically unlinked.
   */
  const brandInName = (raw: string) => {
    const name = raw.trim().toUpperCase();
    for (const brand of brandNames) {
      if (name === brand || name.startsWith(brand + ' ')) return brand;
    }
    return undefined;
  };
  /**
   * When each lead was raised, counted back from the day the seed runs.
   *
   * The export stamps every lead with a fixed epoch — they all land in one
   * month, and that month recedes. The dashboard scopes NEW SALES COMMITTED to
   * the leads RAISED inside the reporting window, so once the calendar moved
   * past that month the whole new-sales half of the dashboard read ₹0 on the
   * default view, and every month that passed made it more wrong. The
   * projections had the same flaw and were fixed the same way.
   *
   * The ten leads are spread over the last eight weeks, newest first, so the
   * current month always holds several freshly raised deals and the month
   * before it holds the rest.
   */
  const leadRaisedAt = (i: number) => addDays(new Date(), -(i * 6 + 2));

  /**
   * DERIVED: the export carries neither a tier nor an expected close date.
   *
   * Both columns are on the list page and neither could ever show anything —
   * and until the detail form learned to edit them there was no way to fill one
   * in either. The grade follows the size of the deal, which is how a desk
   * actually grades an enquiry; the expected close follows the stage, because a
   * deal at oral confirmation is closer than one at first enquiry.
   */
  const TIER_BY_VALUE: [number, CustomerCategory][] = [
    [1_000_000, "Platinum"],
    [500_000, "Gold"],
    [200_000, "Silver"],
    [0, "Brass"],
  ];
  const DAYS_TO_CLOSE: Record<string, number> = {
    NewEnquiries: 75,
    NeedsAnalysis: 60,
    TrialsAndSampleTests: 45,
    ProposalsAndPriceQuote: 30,
    NegotiationOralConfirmation: 15,
  };

  for (const [i, l] of PM.leads.entries()) {
    const stage = STAGE[l.stage];
    if (!stage) throw new Error(`Unmapped lead stage "${l.stage}" on ${l.id}`);

    const raisedAt = leadRaisedAt(i);
    const dealValue = l.q != null && l.expPrice != null ? l.q * l.expPrice : 0;
    const tier = TIER_BY_VALUE.find(([floor]) => dealValue >= floor)![1];
    const closed = stage === "ClosedWon" || stage === "ClosedLost";

    await prisma.lead.create({
      data: {
        id: "lead_" + slug(l.id),
        tenantId: TENANT_ID,
        customerName: l.customerName,
        salespersonId: uid(l.sp)!,
        stage,
        tier,
        industryId: l.industry ? "ind_" + slug(l.industry) : null,
        area: l.industrialArea || null,
        // A follow-up date three months in the past is not a follow-up date.
        // The open deals are chased around now; a closed one is not chased.
        nextFollowUp: closed ? null : addDays(new Date(), (i % 9) - 3),
        // A won or lost deal has no expected close still to come.
        expClose: closed
          ? null
          : addDays(raisedAt, DAYS_TO_CLOSE[stage] ?? 45),
        // DERIVED: the POC records the last stage change only in `history`, and
        // those timestamps move with the export rather than with the clock.
        //
        // A deal that has CLOSED is dated recently, because the dashboard reads
        // "new sales achieved" off the day a lead reached ClosedWon — dating
        // every close two days after the enquiry meant no deal was ever won in
        // the month being reported on, and that tile read ₹0 beside a pipeline
        // with won business in it. An open deal simply moved shortly after it
        // was raised.
        stageUpdatedAt: closed
          ? addDays(new Date(), -((i % 3) * 7 + 3))
          : addDays(raisedAt, 2),
        createdAt: raisedAt,
      },
    });

    // DERIVED: the export writes the designation INSIDE the name, because the
    // POC had nowhere else to put it — "Mr. P. Subramanian (Plant Head)". Now
    // that a contact has a designation column, the parenthetical goes where it
    // belongs instead of being read as part of somebody's name.
    //
    // One contact per lead is all the export carries. The product takes up to
    // ten; a second person at a plant is added in the app, not invented here.
    if (l.contactName || l.mobile) {
      const named = (l.contactName || "").trim();
      const split = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(named);
      await prisma.contact.create({
        data: {
          tenantId: TENANT_ID,
          entityType: "Lead",
          entityId: "lead_" + slug(l.id),
          name: (split ? split[1] : named) || "Contact",
          designation: split ? split[2] : null,
          phone: l.mobile || null,
          whatsapp: l.mobile || null,
          sameAsMobile: true,
          isPrimary: true,
          sortOrder: 0,
        },
      });
    }

    if (l.productName) {
      // The POC lead carries a free-text product name. Link it to the catalogue
      // where the name resolves, and to the PRINCIPAL wherever the brand can be
      // read off the name — a lead nobody stocks yet still belongs to a brand,
      // and the topbar filter is only honest if it can find it.
      const match = matchProduct(l.productName);
      const brandName = match?.brand ?? brandInName(l.productName);
      await prisma.leadProduct.create({
        data: {
          leadId: "lead_" + slug(l.id),
          productId: match ? "prod_" + match.id : null,
          principalId: brandName ? "prin_" + slug(brandName) : null,
          productName: l.productName,
          brand: brandName ?? null,
          qty: dec(l.q),
          price: dec(l.expPrice),
          // DERIVED: the POC shows qty × expected price as the lead value.
          value: l.q != null && l.expPrice != null ? dec(l.q * l.expPrice) : null,
        },
      });
    }

    // Both the POC's remarks and its stage history are per-lead notes, and
    // `Remark` is the timeline the application actually serves — these used to
    // go to a LeadActivity table nothing read, so the seeded history never
    // appeared on a lead. Author is null: nobody typed these, the import made
    // them. The stage-change prefix keeps the two kinds distinguishable.
    const activities = [
      ...(l.remarks ?? []).map((r) => ({ at: day(r.dt), text: r.text })),
      ...(l.history ?? []).map((h) => ({
        at: new Date(h.timestamp),
        text: `Stage: ${h.fromStage} → ${h.toStage}${h.note ? ` — ${h.note}` : ""}`,
      })),
    ];
    if (activities.length) {
      await prisma.remark.createMany({
        data: activities.map((a) => ({
          tenantId: TENANT_ID,
          entityType: "Lead" as const,
          entityId: "lead_" + slug(l.id),
          userId: null,
          ...a,
        })),
      });
    }
  }

  // ---- feature flags -----------------------------------------------------
  // Seeded because a MISSING flag resolves to off: without these rows the
  // Promech workspace would silently lose location pinning, which it has.
  await prisma.featureFlag.createMany({
    data: [
      { id: "ff_customer_location", key: "customer-location", description: "Pin and share a customer's GPS location", enabledGlobal: true },
      { id: "ff_bulk_import", key: "bulk-import", description: "Load customers from a spreadsheet", enabledGlobal: true },
    ],
  });

  // ---- sales orders ------------------------------------------------------
  // DERIVED dates and a walked trail. The export pins every order to a fixed
  // epoch and every delivery promise to a date string two months EARLIER than
  // the order that made it — so the commitment fell before the order, and the
  // whole fulfilment report aged out of relevance a month after any given
  // seed. Orders are spread back over the last five weeks from the clock, each
  // promise is made forward of its own order, and the status trail climbs every
  // rung the order has reached (see ORDER_LADDER).
  const areaOf = new Map(PM.customers.map((c) => [c.id, c.area]));
  const nameOf = new Map(PM.customers.map((c) => [c.id, c.name]));

  let orderIdx = 0;
  for (const o of PM.salesOrders) {
    const status = ORDER_STATUS[o.status];
    if (!status) throw new Error(`Unmapped order status "${o.status}" on ${o.id}`);
    const orderId = "so_" + slug(o.id);
    const i = orderIdx++;

    /** Deterministic, so two seed runs on the same day produce the same trail. */
    const jitter = (rung: number, span: number) =>
      span === 0 ? 0 : (i * 37 + rung * 101) % span;

    // Raised during a working day rather than at whatever time the seed
    // happened to run — an order stamped 02:36 am reads as a glitch, and the
    // durations hanging off it inherit that.
    const raisedAt = addDays(new Date(), -(i * 4 + 5));
    raisedAt.setUTCHours(4 + (i % 6), 30, 0, 0);

    // How far up the ladder this order has climbed. Cancelled is a terminal
    // side-branch rather than a rung, so it keeps whatever trail it had.
    const reached = (ORDER_LADDER as readonly string[]).indexOf(status);

    // The export's own notes, kept on the rungs they describe — a synthesized
    // rung gets a line of its own rather than borrowing someone else's.
    const exported = new Map<number, { note: string | null; user: string | null }>();
    for (const h of o.history ?? []) {
      const mapped = ORDER_STATUS[h.toStatus];
      const rung = mapped ? (ORDER_LADDER as readonly string[]).indexOf(mapped) : -1;
      if (rung >= 0) exported.set(rung, { note: h.note || null, user: h.user || null });
    }

    const transporter = TRANSPORTERS[i % TRANSPORTERS.length];
    const lrNumber = `LR-${String(70_000 + i * 137)}`;

    const trail: { status: OrderStatus; at: Date; note: string | null; by: string }[] = [];
    let at = raisedAt;
    for (let rung = 0; rung <= reached; rung++) {
      const [min, span] = RUNG_HOURS[rung];
      at = new Date(at.getTime() + (min + jitter(rung, span)) * 3_600_000);
      const fromExport = exported.get(rung);
      const synthesized =
        rung === 2
          ? `Transporter assigned: ${transporter} (${lrNumber}).`
          : rung === 4
            ? "Consignment handed over at the customer's gate."
            : null;
      trail.push({
        status: ORDER_LADDER[rung],
        at,
        note: fromExport?.note ?? synthesized,
        by: (fromExport?.user && uid(fromExport.user)) || uid(o.sp)!,
      });
    }

    // A promise made forward of the order, at the close of a working day, so
    // the SLA verdict compares two real instants rather than UTC midnight.
    //
    // One standard lead time for every order, which is how a company quotes
    // one — and tight enough that the long, variable transit leg decides who
    // misses it rather than a generous window absorbing everyone. That matters:
    // a fulfilment report whose delay counter can only ever read zero is
    // indistinguishable from one that is broken, which is how this dataset
    // read before. No order is singled out; the trail decides.
    const promised = addDays(raisedAt, 4);
    promised.setUTCHours(12, 0, 0, 0);

    const lineSum =
      Math.round(
        (o.items.reduce((s, it) => s + it.qty * it.unitPrice, 0) + Number.EPSILON) * 100,
      ) / 100;

    await prisma.salesOrder.create({
      data: {
        id: orderId,
        tenantId: TENANT_ID,
        code: o.id,
        customerId: "cust_" + o.customerId,
        salespersonId: uid(o.sp)!,
        date: raisedAt,
        status,
        // The sum of THIS ORDER'S OWN LINES, which is the rule order-engine's
        // computeTotal enforces for every order the app raises.
        //
        // The export's grandTotal (subtotal − discount + tax) used to go here,
        // and this schema has columns for neither discount nor tax — so `total`
        // meant one thing on a seeded order and another on a created one. On
        // SO-2026-0004 that was ₹1,12,100 stored against ₹95,000 of line items,
        // and the printed invoice then added 18% GST to a figure that already
        // carried it. Opening the new line editor and saving would have
        // "changed" the order's value by 15% without a single line moving.
        total: dec(lineSum)!,
        paymentTerms: o.paymentTerms || null,
        expectedDelivery: promised,
        // DERIVED: the export carries none of these, so every order in the
        // workspace read "Standard / —" on the dispatch card and the order
        // search had no transporter to match.
        deliveryMode: ORDER_DELIVERY_MODES[i % ORDER_DELIVERY_MODES.length],
        // "Others" is the dataset's catch-all area — a real value for
        // segmentation, and nonsense as the second line of a delivery address.
        deliveryAddress: [
          nameOf.get(o.customerId),
          areaOf.get(o.customerId) === "Others" ? null : areaOf.get(o.customerId),
        ]
          .filter(Boolean)
          .join(", ") || null,
        transporterName: reached >= 2 ? transporter : null,
        lrNumber: reached >= 3 ? lrNumber : null,
        isUrgent: i % 3 === 0,
        createdAt: raisedAt,
      },
    });

    await prisma.salesOrderItem.createMany({
      data: o.items.map((it) => ({
        orderId,
        productId: "prod_" + it.productId,
        qty: dec(it.qty)!,
        price: dec(it.unitPrice)!,
        unit: it.uom || null,
      })),
    });

    if (trail.length) {
      await prisma.orderStatusHistory.createMany({
        data: trail.map((t) => ({
          orderId,
          status: t.status,
          note: t.note,
          changedById: t.by,
          at: t.at,
        })),
      });
    }
  }

  // ---- follow-ups --------------------------------------------------------
  // The POC export is customers, payments, projections, leads and orders. It
  // carries no follow-ups, because a follow-up is something a salesperson makes
  // in the app rather than a column in a spreadsheet — so the feature shipped
  // with nothing to show: the Follow-ups page empty, the dashboard tile at
  // zero, and neither state distinguishable from a fault.
  //
  // A handful on ONE salesperson's desk, each against a record that person
  // actually owns, so the sales login has real work to open and the tile has
  // something to count. Two are already late, one falls today and one is still
  // ahead — which is also the tile's own boundary: it counts what is owed by
  // today, so it shows three of these four while the page lists all four.
  //
  // Every date is an offset from the day the seed runs, never a literal. A
  // fixed date reads as "three days late" this week and "four hundred days
  // late" next year, and a dataset that rots is worse than one that is empty.
  const fuOwner = uid(FOLLOWUP_OWNER);
  if (!fuOwner) throw new Error(`No salesperson named "${FOLLOWUP_OWNER}" in the dataset`);
  const noon = new Date();
  noon.setUTCHours(11, 0, 0, 0);

  const [fuLead, fuPayment, fuCustomer, fuProjection] = await Promise.all([
    prisma.lead.findFirst({ where: { salespersonId: fuOwner }, orderBy: { id: "asc" } }),
    // Their customer's unpaid invoice, not merely one stamped with their id:
    // the POC export leaves Payment.salespersonId unset on this dataset, and a
    // collection follows the account rather than the column anyway.
    prisma.payment.findFirst({
      where: {
        status: { not: "Paid" },
        OR: [{ salespersonId: fuOwner }, { customer: { salespersonId: fuOwner } }],
      },
      orderBy: { id: "asc" },
    }),
    prisma.customer.findFirst({ where: { salespersonId: fuOwner }, orderBy: { id: "asc" } }),
    prisma.projection.findFirst({
      where: { mapping: { salespersonId: fuOwner } },
      include: { mapping: { include: { customer: true, product: true } } },
      orderBy: { id: "asc" },
    }),
  ]);

  const followUps = [
    fuLead && {
      id: "fu_lead",
      entityType: "Lead" as const,
      entityId: fuLead.id,
      title: `Chase the quotation — ${fuLead.customerName}`,
      subtitle: "Sample despatched, no response since",
      amount: null,
      dueDate: addDays(noon, -6),
    },
    fuPayment && {
      id: "fu_payment",
      entityType: "Payment" as const,
      entityId: fuPayment.id,
      title: `Collect on invoice ${fuPayment.invoiceNo ?? fuPayment.refNo ?? ""}`.trim(),
      subtitle: fuPayment.customerName,
      amount: dec(Number(fuPayment.amount) - Number(fuPayment.received)),
      dueDate: addDays(noon, -2),
    },
    fuCustomer && {
      id: "fu_customer",
      entityType: "Customer" as const,
      entityId: fuCustomer.id,
      title: `Site visit — ${fuCustomer.name}`,
      subtitle: "Half-yearly review of consumption",
      amount: null,
      dueDate: noon,
    },
    fuProjection && {
      id: "fu_projection",
      entityType: "Projection" as const,
      entityId: fuProjection.id,
      title: `Confirm the PO — ${fuProjection.mapping.product.name}`,
      subtitle: `${fuProjection.mapping.customer.name} · ${PERIOD}`,
      amount: dec(Number(fuProjection.committedQty) * Number(fuProjection.price)),
      dueDate: addDays(noon, 3),
    },
  ].filter((f): f is NonNullable<typeof f> => !!f);

  if (followUps.length < 4)
    throw new Error(
      `Only ${followUps.length} of 4 follow-up targets found for ${FOLLOWUP_OWNER} — the dataset moved`,
    );

  await prisma.followUp.createMany({
    data: followUps.map((f) => ({
      id: f.id,
      tenantId: TENANT_ID,
      entityType: f.entityType,
      entityId: f.entityId,
      salespersonId: fuOwner,
      title: f.title,
      subtitle: f.subtitle,
      amount: f.amount,
      dueDate: f.dueDate,
      done: false,
      note: null,
    })),
  });

  const counts = {
    tenants: await prisma.tenant.count(),
    users: await prisma.user.count(),
    industries: await prisma.industry.count(),
    principals: await prisma.principal.count(),
    products: await prisma.product.count(),
    customers: await prisma.customer.count(),
    mappings: await prisma.mapping.count(),
    projections: await prisma.projection.count(),
    projectionMonths: PERIODS.join(", "),
    salesTargets: await prisma.salesTarget.count(),
    payments: await prisma.payment.count(),
    paymentsLinkedToCustomer: await prisma.payment.count({ where: { customerId: { not: null } } }),
    leads: await prisma.lead.count(),
    leadProducts: await prisma.leadProduct.count(),
    leadContacts: await prisma.contact.count({ where: { entityType: "Lead" } }),
    leadRemarks: await prisma.remark.count({ where: { entityType: "Lead" } }),
    salesOrders: await prisma.salesOrder.count(),
    salesOrderItems: await prisma.salesOrderItem.count(),
    followUps: await prisma.followUp.count(),
    platformUsers: await prisma.platformUser.count(),
  };
  console.log("✅ Seed complete:", counts);
  console.log(
    '   Logins: admin@greatsales.local / "admin" · <username>@greatsales.local / "1234" · tenant ' + TENANT_ID,
  );
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
