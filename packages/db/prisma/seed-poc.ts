/**
 * GreatSales CRM — seed from the POC v6 dataset.
 *
 * Source of truth: prisma/poc-v6-data.json, extracted verbatim from
 * Downloads/GreatSales_Tracker_POC_v6.html (SEED, PAY_SEED, SEED_USERS,
 * INDUSTRY_TAXONOMY, INDUSTRIAL_AREAS). Nothing here is invented data — the
 * only derived columns are noted inline (customer outstanding / payZone,
 * payment status / agingDays), all computed from POC numbers.
 *
 * Idempotent: TRUNCATEs every table (dev DB only) then reinserts.
 *
 * Logins are the POC's own credentials: `admin` / "admin", everyone else
 * "1234". Login is by EMAIL in this API, so each POC username `u` becomes
 * `<u>@greatsales.local`.
 */
import { loadDataset } from "./dataset";
import { assertDestructiveSeedAllowed } from "./seed-guard";
import {
  PrismaClient,
  type CustomerCategory,
  type Division,
  type CustomerType,
  type PayZone,
  type PaymentStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = "tenant_greatsales";
const TENANT_NAME = "GreatSales Tracker";
const PERIOD = "2026-06"; // the POC's seeded projection month

// argon2id hashes of the POC's demo passwords (dev only).
const PW_ADMIN =
  "$argon2id$v=19$m=19456,t=2,p=1$PXG/62M4okQJXMC6W+qhXw$GfLM1P7AJ8gifaHC42aolsL4tghggmv4tacSH3gm6I4"; // "admin"
const PW_1234 =
  "$argon2id$v=19$m=19456,t=2,p=1$5cNwq8vIHGkPvFoLLh5NTQ$Z6uxK4mcykUWL+CSjAPrVJnTQUfnWT1BnM6ddXKvcpk"; // "1234"
const PW_PLATFORM =
  "$argon2id$v=19$m=19456,t=2,p=1$YMotFINPtldbJwk7BTyfWA$TlIBiSz3th5+VSEv55i/QkkxiTJSfHY+hhVvt4eSh3Q"; // "Passw0rd!"

// ---------------------------------------------------------------- POC data
type PocUser = {
  id: string;
  u: string;
  p: string;
  role: "admin" | "mgmt" | "sales";
  name: string;
  active: boolean;
};
type PocCustomer = { id: string; name: string; div: string; cat: string; type: string; sp: string; pay: string };
type PocProduct = { id: string; name: string; brand: string; div: string; price: number | null };
type PocMap = { id: string; c: string; p: string; sp: string; price: number | null };
type PocProj = { m: string; q: number; price: number | null };
type PocPayment = {
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

const POC = loadDataset<{
  users: PocUser[];
  industries: Record<string, string[]>;
  areas: string[];
  salespersons: string[];
  customers: PocCustomer[];
  products: PocProduct[];
  maps: PocMap[];
  juneProj: PocProj[];
  payments: PocPayment[];
}>("poc-v6-data.json", __dirname);

// Permission catalog (global, tenant-agnostic keys).
const PERMISSIONS: { key: string; module: string }[] = [
  { key: "customer.read", module: "customer" },
  { key: "customer.write", module: "customer" },
  { key: "lead.read", module: "lead" },
  { key: "lead.write", module: "lead" },
  { key: "projection.read", module: "projection" },
  { key: "projection.write", module: "projection" },
  { key: "order.read", module: "order" },
  { key: "order.write", module: "order" },
  { key: "payment.read", module: "payment" },
  { key: "payment.write", module: "payment" },
  { key: "user.manage", module: "admin" },
  { key: "role.manage", module: "admin" },
  { key: "report.view", module: "report" },
];

// Role → permission keys. Mirrors the POC's three roles.
const ROLE_PERMS: Record<string, string[]> = {
  admin: PERMISSIONS.map((p) => p.key),
  mgmt: ["customer.read", "lead.read", "projection.read", "order.read", "payment.read", "report.view"],
  sales: [
    "customer.read",
    "customer.write",
    "lead.read",
    "lead.write",
    "projection.read",
    "projection.write",
    "order.read",
    "order.write",
    "payment.read",
  ],
};

// ---------------------------------------------------------------- helpers
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
const division = (d: string): Division | null => (d === "LUB" || d === "WES" ? d : null);
const category = (c: string): CustomerCategory | null =>
  c === "Platinum" || c === "Gold" || c === "Silver" || c === "Brass" ? c : null;
const custType = (t: string): CustomerType | null => (t === "Existing" || t === "New" ? t : null);
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

/** Normalize a company name so PAY_SEED parties can be matched to customers. */
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
  console.log("🌱 Seeding GreatSales from POC v6 data…");
  await reset();

  // ---- globals: permissions + the POC's industry taxonomy ----------------
  await prisma.permission.createMany({ data: PERMISSIONS });
  await prisma.industry.createMany({
    data: Object.entries(POC.industries).map(([name, subs]) => ({
      id: "ind_" + slug(name),
      name,
      subIndustries: subs,
    })),
  });

  // ---- platform layer (operator-side infrastructure, not POC data) -------
  await prisma.platformUser.create({
    data: {
      id: "pu_super",
      name: "Platform Super Admin",
      email: "super@greatsales.io",
      passwordHash: PW_PLATFORM,
      role: "SuperAdmin",
    },
  });
  await prisma.featureFlag.createMany({
    data: [
      {
        id: "ff_customer_location",
        key: "customer-location",
        description: "Pin and share a customer's GPS location",
        enabledGlobal: true,
      },
      { id: "ff_bulk_import", key: "bulk-import", description: "Excel bulk import UI", enabledGlobal: true },
    ],
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
  const manager = POC.users.find((u) => u.role === "mgmt")!;

  for (const u of POC.users) {
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

  // Team owned by the POC "Management" user; salespeople report into it.
  await prisma.team.create({
    data: { id: "team_sales", tenantId: TENANT_ID, name: "Sales Team", managerId: userId(manager.u) },
  });
  await prisma.user.updateMany({
    where: { tenantId: TENANT_ID, roleId: "role_sales" },
    data: { managerId: userId(manager.u), teamId: "team_sales" },
  });

  // The POC stores salesperson/collector as a free-text NAME. Every name used
  // by customers/mappings must resolve to a User row (FK). "Sathish" appears
  // only as a payment collector and has no POC login → seeded inactive so the
  // assignment survives without inventing a credential.
  const byName = new Map(POC.users.map((u) => [u.name, userId(u.u)]));
  const extraNames = new Set<string>();
  for (const c of POC.customers) {
    for (const n of [c.sp, c.pay]) if (n && !byName.has(n)) extraNames.add(n);
  }
  for (const m of POC.maps) if (m.sp && !byName.has(m.sp)) extraNames.add(m.sp);
  for (const name of extraNames) {
    const un = slug(name);
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

  // ---- principals (POC product brands) + products ------------------------
  const brands = [...new Set(POC.products.map((p) => p.brand))].sort();
  await prisma.principal.createMany({
    data: brands.map((b) => ({ id: "prin_" + slug(b), tenantId: TENANT_ID, name: b })),
  });
  await prisma.product.createMany({
    data: POC.products.map((p) => ({
      id: "prod_" + p.id,
      tenantId: TENANT_ID,
      principalId: "prin_" + slug(p.brand),
      name: p.name,
      sku: p.id,
      division: division(p.div),
      basePrice: dec(p.price),
    })),
  });

  // ---- payments first, so customer outstanding/zone can be rolled up -----
  // PAY_SEED identifies the party by name only. Match on a normalized name, but
  // refuse ambiguous keys: a handful of POC customers normalize to the same key
  // ("LAKSHMI INDUSTRIES" vs "Lakshmi Enterprises"), and guessing there would
  // attach real money to the wrong account. Those fall back to an exact-name
  // match, and stay unlinked (customerName only) if that fails too.
  const byNorm = new Map<string, PocCustomer[]>();
  const byExact = new Map<string, PocCustomer>();
  for (const c of POC.customers) {
    const k = normName(c.name);
    byNorm.set(k, [...(byNorm.get(k) ?? []), c]);
    byExact.set(c.name.trim().toUpperCase(), c);
  }
  const matchCustomer = (party: string): PocCustomer | null => {
    const candidates = byNorm.get(normName(party)) ?? [];
    if (candidates.length === 1) return candidates[0];
    return byExact.get(party.trim().toUpperCase()) ?? null;
  };

  const rollup = new Map<string, { pending: number; zone: PayZone | null }>();
  const paymentRows = POC.payments.map((r, i) => {
    const match = matchCustomer(r.party);
    // PAY_SEED carries opening / pending / received as three independent imported
    // columns. This API derives pending as amount − received at read time, so
    // `received` is seeded as opening − pending to keep the POC's *pending*
    // figure — the number collections actually works from — exact. For the 9 rows
    // where the POC also lists a `received` amount, that value is a single
    // receipt rather than the receipts-to-date this column means.
    const received = Math.max(r.opening - r.pending, 0);
    const zone = payZone(r.zone);
    // Same rule the API's deriveStatus() applies when it writes this snapshot
    // column, so a seeded row filters identically to an API-created one.
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
      // Every POC customer is on the 30-day credit default, so the invoice date
      // gives the due date. Without it the API reports agingDays: null and never
      // flags a receivable Overdue — it derives both from dueDate at read time.
      dueDate: addDays(day(r.date), 30),
      customerId: match ? "cust_" + match.id : null,
      customerName: r.party,
      // POC leaves payment ownership blank ("Unassigned") — kept faithful.
      salespersonId: null,
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
      status,
    };
  });

  // ---- customers ---------------------------------------------------------
  await prisma.customer.createMany({
    data: POC.customers.map((c) => {
      const roll = rollup.get(c.id);
      return {
        id: "cust_" + c.id,
        tenantId: TENANT_ID,
        name: c.name,
        division: division(c.div),
        category: category(c.cat),
        type: custType(c.type),
        // POC default for every seeded customer.
        paymentTerms: "Credit30" as const,
        payZone: roll?.zone ?? null,
        outstanding: dec(roll?.pending ?? 0)!,
        salespersonId: uid(c.sp)!,
        collectorId: uid(c.pay),
      };
    }),
  });

  await prisma.payment.createMany({ data: paymentRows });

  // ---- mappings (customer × product) + June projections ------------------
  await prisma.mapping.createMany({
    data: POC.maps.map((m) => ({
      id: "map_" + m.id,
      tenantId: TENANT_ID,
      customerId: "cust_" + m.c,
      productId: "prod_" + m.p,
      salespersonId: uid(m.sp)!,
      customPrice: dec(m.price),
    })),
  });

  await prisma.projection.createMany({
    data: POC.juneProj.map((j) => ({
      tenantId: TENANT_ID,
      mappingId: "map_" + j.m,
      period: PERIOD,
      committedQty: String(j.q),
      achievedQty: "0",
      price: dec(j.price),
      status: "ProjectionCreated" as const,
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
    payments: await prisma.payment.count(),
    paymentsLinkedToCustomer: await prisma.payment.count({ where: { customerId: { not: null } } }),
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
