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
  type DealStage,
  type Division,
  type OrderStatus,
  type PayZone,
  type PaymentStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = "tenant_promech";
const TENANT_NAME = "Promech Industrial Sales";
const PERIOD = "2026-06"; // the only projection month the POC carries

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
    "LeadActivity","LeadProduct","Lead","Projection","SalesTarget","Mapping",
    "Product","Principal","CustomerContact","Customer","FollowUp","Activity",
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

  await prisma.projection.createMany({
    data: PM.juneProj.map((j) => ({
      tenantId: TENANT_ID,
      mappingId: "map_" + j.m,
      period: PERIOD,
      committedQty: String(j.q),
      achievedQty: "0",
      price: dec(j.price),
      status: "ProjectionCreated" as const,
    })),
  });

  // ---- leads -------------------------------------------------------------
  const productByName = new Map(PM.products.map((p) => [p.name.trim().toUpperCase(), p]));
  for (const l of PM.leads) {
    const stage = STAGE[l.stage];
    if (!stage) throw new Error(`Unmapped lead stage "${l.stage}" on ${l.id}`);

    await prisma.lead.create({
      data: {
        id: "lead_" + slug(l.id),
        tenantId: TENANT_ID,
        customerName: l.customerName,
        salespersonId: uid(l.sp)!,
        stage,
        industryId: l.industry ? "ind_" + slug(l.industry) : null,
        area: l.industrialArea || null,
        contactName: l.contactName || null,
        phone: l.mobile || null,
        nextFollowUp: l.nextFollowUpDate ? day(l.nextFollowUpDate) : null,
        // DERIVED: the POC records the last stage change only in `history`;
        // its most recent entry is the stage's timestamp.
        stageUpdatedAt: l.history?.length
          ? new Date(Math.max(...l.history.map((h) => h.timestamp)))
          : null,
        createdAt: l.createdAt ? new Date(l.createdAt) : undefined,
      },
    });

    if (l.productName) {
      // The POC lead carries a free-text product name; link it to the catalog
      // when the name matches exactly, otherwise keep the text only.
      const match = productByName.get(l.productName.trim().toUpperCase());
      await prisma.leadProduct.create({
        data: {
          leadId: "lead_" + slug(l.id),
          productId: match ? "prod_" + match.id : null,
          principalId: match ? "prin_" + slug(match.brand) : null,
          productName: l.productName,
          brand: match?.brand ?? null,
          qty: dec(l.q),
          price: dec(l.expPrice),
          // DERIVED: the POC shows qty × expected price as the lead value.
          value: l.q != null && l.expPrice != null ? dec(l.q * l.expPrice) : null,
        },
      });
    }

    // Both the POC's remarks and its stage history are per-lead notes; they
    // land in the one activity log this schema provides, kept distinguishable
    // by the stage-change prefix.
    const activities = [
      ...(l.remarks ?? []).map((r) => ({ date: day(r.dt), note: r.text })),
      ...(l.history ?? []).map((h) => ({
        date: new Date(h.timestamp),
        note: `Stage: ${h.fromStage} → ${h.toStage}${h.note ? ` — ${h.note}` : ""}`,
      })),
    ];
    if (activities.length) {
      await prisma.leadActivity.createMany({
        data: activities.map((a) => ({ leadId: "lead_" + slug(l.id), ...a })),
      });
    }
  }

  // ---- sales orders ------------------------------------------------------
  for (const o of PM.salesOrders) {
    const status = ORDER_STATUS[o.status];
    if (!status) throw new Error(`Unmapped order status "${o.status}" on ${o.id}`);
    const orderId = "so_" + slug(o.id);

    await prisma.salesOrder.create({
      data: {
        id: orderId,
        tenantId: TENANT_ID,
        code: o.id,
        customerId: "cust_" + o.customerId,
        salespersonId: uid(o.sp)!,
        date: o.createdAt ? new Date(o.createdAt) : new Date(),
        status,
        // The POC's grandTotal is subtotal − discount + tax; this column is the
        // order's payable value, so grandTotal is the right source.
        total: dec(o.grandTotal)!,
        paymentTerms: o.paymentTerms || null,
        expectedDelivery: o.deliveryDate ? day(o.deliveryDate) : null,
        createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
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

    if (o.history?.length) {
      await prisma.orderStatusHistory.createMany({
        data: o.history
          .filter((h) => ORDER_STATUS[h.toStatus])
          .map((h) => ({
            orderId,
            status: ORDER_STATUS[h.toStatus],
            note: h.note || null,
            changedById: (h.user && uid(h.user)) || uid(o.sp)!,
            at: new Date(h.timestamp),
          })),
      });
    }
  }

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
    leads: await prisma.lead.count(),
    leadProducts: await prisma.leadProduct.count(),
    leadActivities: await prisma.leadActivity.count(),
    salesOrders: await prisma.salesOrder.count(),
    salesOrderItems: await prisma.salesOrderItem.count(),
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
