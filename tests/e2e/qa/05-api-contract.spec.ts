import { test, expect } from "@playwright/test";
import { CREDENTIALS, TENANT, apiToken, auth } from "../helpers/session";

/**
 * The API on its own terms. The browser is not involved: these are the checks
 * that matter when someone calls the endpoints directly — authentication,
 * validation, filter semantics, pagination and the error envelope.
 */

const LIST_ENDPOINTS = [
  "customers",
  "leads",
  "orders",
  "payments",
  "products",
  "principals",
  "mappings",
  "followups",
  "projections",
  "users",
  "teams",
];

test.describe("API contract", () => {
  test("every list endpoint refuses an anonymous caller", async ({ request }) => {
    for (const e of LIST_ENDPOINTS) {
      const res = await request.get(`/api/v1/${e}`);
      expect(res.status(), `GET /${e} unauthenticated`).toBe(401);
    }
  });

  test("a forged or truncated bearer token is refused", async ({ request }) => {
    for (const token of ["not-a-token", "a.b.c", ""]) {
      const res = await request.get("/api/v1/customers", { headers: auth(token) });
      expect(res.status(), `token "${token}"`).toBe(401);
    }
  });

  test("errors come back in the documented envelope", async ({ request }) => {
    const res = await request.get("/api/v1/customers");
    const body = await res.json();
    expect(body).toMatchObject({ statusCode: 401 });
    expect(typeof body.message, "message must be a string").toBe("string");
  });

  test("a boolean query filter honours false — z.coerce.boolean() maps 'false' to true", async ({
    request,
  }) => {
    const token = await apiToken(request, "admin");

    // Follow-ups: the page always asks for done=false. If false is coerced to
    // true the timeline silently renders nothing.
    const notDone = await request.get("/api/v1/followups?done=false&limit=5", {
      headers: auth(token),
    });
    expect(notDone.status()).toBe(200);
    for (const row of (await notDone.json()).items) {
      expect(row.done, "done=false must not return done rows").toBe(false);
    }

    const done = await request.get("/api/v1/followups?done=true&limit=5", {
      headers: auth(token),
    });
    for (const row of (await done.json()).items) {
      expect(row.done).toBe(true);
    }

    const inactive = await request.get("/api/v1/customers?active=false&limit=5", {
      headers: auth(token),
    });
    expect(inactive.status()).toBe(200);
    for (const row of (await inactive.json()).items ?? []) {
      expect(row.active, "active=false must not return active rows").toBe(false);
    }
  });

  test("pagination: limit is honoured, the cursor advances, pages do not overlap", async ({
    request,
  }) => {
    const token = await apiToken(request, "admin");
    const first = await request.get("/api/v1/customers?limit=5", { headers: auth(token) });
    expect(first.status()).toBe(200);
    const p1 = await first.json();
    expect(p1.items.length).toBe(5);
    expect(p1.nextCursor, "417 seeded customers means there is a second page").toBeTruthy();

    const second = await request.get(`/api/v1/customers?limit=5&cursor=${p1.nextCursor}`, {
      headers: auth(token),
    });
    const p2 = await second.json();
    const overlap = p2.items.filter((r: { id: string }) => p1.items.some((a: { id: string }) => a.id === r.id));
    expect(overlap, "a cursor page must not repeat the previous page").toHaveLength(0);
  });

  test("an oversized limit is rejected instead of scanning the table", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const res = await request.get("/api/v1/customers?limit=100000", { headers: auth(token) });
    expect(res.status(), "limit must be capped").toBe(400);
  });

  test("a garbage cursor is a 4xx, never a 500", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const res = await request.get("/api/v1/customers?limit=5&cursor=%00%27--", {
      headers: auth(token),
    });
    expect(res.status(), `got ${res.status()}`).toBeLessThan(500);
  });

  test("SQL metacharacters in search are data, not syntax", async ({ request }) => {
    const token = await apiToken(request, "admin");
    for (const probe of ["' OR 1=1 --", "'; DROP TABLE customers; --", "%"]) {
      const res = await request.get(
        `/api/v1/customers?limit=5&search=${encodeURIComponent(probe)}`,
        { headers: auth(token) },
      );
      expect(res.status(), `search=${probe}`).toBe(200);
    }
    // The table is still there afterwards.
    const after = await request.get("/api/v1/customers?limit=1", { headers: auth(token) });
    expect((await after.json()).items.length).toBe(1);
  });

  test("an unknown id is a 404, not a 500 or someone else's row", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const res = await request.patch("/api/v1/customers/cust_does_not_exist", {
      headers: auth(token),
      data: { name: "should not apply" },
    });
    expect([400, 404], `got ${res.status()}`).toContain(res.status());
  });

  test("an invalid enum value is rejected with the offending path named", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const res = await request.post("/api/v1/followups", {
      headers: auth(token),
      data: { entityType: "customer", entityId: "cust_C001", dueDate: "2026-01-01" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(JSON.stringify(body.details)).toContain("entityType");
  });

  test("a negative amount is refused", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const res = await request.post("/api/v1/payments", {
      headers: auth(token),
      data: { party: "QA", amount: -5000 },
    });
    expect(res.status(), "negative money must not be accepted").toBeGreaterThanOrEqual(400);
  });

  test("the login endpoint does not reveal whether an email exists", async ({ request }) => {
    const unknown = await request.post("/api/v1/auth/login", {
      data: { tenantId: TENANT, email: "nobody@greatsales.local", password: "whatever" },
    });
    const wrongPassword = await request.post("/api/v1/auth/login", {
      data: { tenantId: TENANT, email: CREDENTIALS.admin.email, password: "wrong-password" },
    });
    expect(unknown.status()).toBe(wrongPassword.status());
    expect((await unknown.json()).message).toBe((await wrongPassword.json()).message);
  });

  test("no password material is ever returned by the users endpoint", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const res = await request.get("/api/v1/users?limit=20", { headers: auth(token) });
    const text = await res.text();
    expect(text).not.toMatch(/passwordHash|\$argon2|"password"/);
  });

  test("the throttler is armed — a burst of logouts is cut off with 429", async ({ request }) => {
    const codes: number[] = [];
    for (let i = 0; i < 26; i++) {
      const res = await request.post("/api/v1/auth/logout", { data: {} });
      codes.push(res.status());
    }
    expect(codes, `saw ${codes.join(",")}`).toContain(429);
  });
});
