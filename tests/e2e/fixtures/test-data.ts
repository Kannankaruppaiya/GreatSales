/**
 * Shared Test Data & Fixtures for GreatSales Playwright End-to-End Test Suite.
 * Centralizes credentials, tenant identifiers, deterministic seeded parameters,
 * and randomized data generators to avoid test collision.
 */

export const TENANT = "tenant_promech";
/**
 * The seed gives the workspace the tenant's own id. This was the literal
 * "greatsales-industrial-corp" — the console's `DEFAULT_MANAGEMENT_ID`, which
 * no seeded workspace has ever carried — and an unknown workspace is bounced to
 * the real one's dashboard, so every URL below quietly resolved to the same
 * page. Derive it, so the two cannot part again.
 */
export const MGMT_ID = TENANT;
/**
 * The month the seed opens, `YYYY-MM`.
 *
 * It was the literal "2026-06", which stopped being true the moment the
 * calendar passed June: a spec selecting it landed on a month with no rows and
 * failed for a reason that had nothing to do with the page. The seed counts its
 * months back from the day it runs and leaves the current one open, so that is
 * what this names.
 */
export const SEEDED_PERIOD = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

export const URLS = {
  dashboard: `/managements/${MGMT_ID}/dashboard`,
  projections: `/managements/${MGMT_ID}/projections`,
  leads: `/managements/${MGMT_ID}/leads`,
  orders: `/managements/${MGMT_ID}/orders`,
  payments: `/managements/${MGMT_ID}/payments`,
  followups: `/managements/${MGMT_ID}/followups`,
  customers: `/managements/${MGMT_ID}/customers`,
  mappings: `/managements/${MGMT_ID}/mappings`,
  products: `/managements/${MGMT_ID}/products`,
  users: `/managements/${MGMT_ID}/users`,
  data: `/managements/${MGMT_ID}/data`,
  adminLogin: "/admin/login",
  salesLogin: "/sales/login",
  mgmtLogin: "/management/login",
  superAdminLogin: "/super-admin/login",
} as const;

export const SEEDED_CREDENTIALS = {
  admin: {
    email: "admin@greatsales.local",
    password: "admin",
    portal: "admin",
    displayName: "Administrator",
  },
  sales: {
    email: "megala@greatsales.local",
    password: "1234",
    portal: "sales",
    displayName: "Megala",
  },
  mgmt: {
    email: "manager@greatsales.local",
    password: "1234",
    portal: "management",
    displayName: "Management",
  },
} as const;

/** Creates collision-free unique identifier with an optional prefix */
export function uniqueId(prefix = "qa"): string {
  const stamp = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 10000).toString(36);
  return `${prefix}_${stamp}_${rand}`;
}

/** Generates clean, compliant test user registration payloads */
export function generateTestUser(options?: { role?: string; prefix?: string }) {
  const id = uniqueId(options?.prefix ?? "salesrep");
  return {
    name: `QA Representative ${id.slice(-5)}`,
    username: id.toLowerCase(),
    email: `${id.toLowerCase()}@greatsales.local`,
    password: "QaPassw0rd!2026",
    role: options?.role ?? "sales",
  };
}

/** Generates invalid user inputs for negative testing */
export function generateInvalidUserInputs() {
  return {
    missingName: {
      name: "",
      username: uniqueId("user"),
      email: `${uniqueId("user")}@greatsales.local`,
      password: "QaPassw0rd!2026",
    },
    invalidEmail: {
      name: "Invalid Email User",
      username: uniqueId("user"),
      email: "not-an-email-address",
      password: "QaPassw0rd!2026",
    },
    weakPassword: {
      name: "Weak Pass User",
      username: uniqueId("user"),
      email: `${uniqueId("user")}@greatsales.local`,
      password: "123",
    },
    duplicateUsername: {
      name: "Duplicate User",
      username: "admin", // seeded existing username
      email: "admin@greatsales.local",
      password: "QaPassw0rd!2026",
    },
  };
}

/** Generates principal brand payload */
export function generatePrincipalBrand() {
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return {
    name: `PRIN-QA-${stamp}`,
  };
}

/** Generates catalog product SKU payload */
export function generateProductCatalogItem(principalBrandName?: string) {
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return {
    name: `QA Synthetic Lubricant Pro ${stamp}`,
    sku: `SKU-QA-${stamp}`,
    division: "LUB" as const,
    unit: "Ltr",
    listPrice: "450",
    updatedPrice: "520",
    principalBrand: principalBrandName ?? "IPOL",
  };
}

/** Generates new sales customer (lead) payload */
export function generateLeadData() {
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return {
    companyName: `Apex Manufacturing ${stamp} Ltd`,
    contactPerson: `Dinakaran ${stamp}`,
    mobile: "9444011223",
    email: `contact.${stamp.toLowerCase()}@apexmanufacturing.com`,
    estimatedValue: "185000",
  };
}

/** Generates customer master payload */
export function generateCustomerData() {
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return {
    name: `Sri Lakshmi Precision Tools ${stamp}`,
    contactName: `K. Narayanan`,
    phone: "9840855443",
    email: `procurement.${stamp.toLowerCase()}@srilakshmi.in`,
    category: "Tier-1",
    area: "Ambattur Industrial Estate",
  };
}

/** Generates follow-up item payload */
export function generateFollowUpData() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    type: "Customer" as const,
    notes: `Scheduled product demo & commercial quote review #${uniqueId("fu")}`,
    dueDate: today,
  };
}
