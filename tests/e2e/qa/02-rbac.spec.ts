import { test, expect } from "@playwright/test";
import { FEATURES, featuresFor } from "../helpers/features";
import { CREDENTIALS, TENANT, apiToken, auth, featureUrl, loginAs } from "../helpers/session";

/**
 * Role separation, checked on both sides of the wire: the sidebar and the route
 * guard must match the registry, and the API must refuse the same thing on its
 * own — a frontend that merely hides a page is not authorization.
 */
test.describe("RBAC — sidebar, route guard and API agree", () => {
  for (const role of ["admin", "mgmt", "sales"] as const) {
    test(`${role}: sidebar lists exactly the features the registry allows`, async ({ page }) => {
      await loginAs(page, role);
      const allowed = featuresFor(role).map((f) => f.key);
      const denied = FEATURES.filter((f) => !f.roles.includes(role)).map((f) => f.key);

      const sidebar = page.locator("aside");
      for (const key of allowed) {
        await expect(sidebar.locator(`a[href$="/${key}"]`), `${role} should see ${key}`).toHaveCount(
          1,
        );
      }
      for (const key of denied) {
        await expect(
          sidebar.locator(`a[href$="/${key}"]`),
          `${role} must not see ${key}`,
        ).toHaveCount(0);
      }
    });

    test(`${role}: deep-linking a denied feature shows Access Restricted, not the page`, async ({
      page,
    }) => {
      await loginAs(page, role);
      const denied = FEATURES.filter((f) => !f.roles.includes(role));
      test.skip(denied.length === 0, `${role} has access to every feature`);

      for (const f of denied) {
        await page.goto(featureUrl(f.key));
        await expect(page.getByText(/Access Restricted/i)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/Administrative Permission Required/i)).toBeVisible();
        // The guard replaces the page body: none of the feature's own data renders.
        await expect(page.locator("table")).toHaveCount(0);
      }
    });
  }

  test("sales role only receives its own customers from the API", async ({ request }) => {
    const salesToken = await apiToken(request, "sales");
    const adminToken = await apiToken(request, "admin");

    const mine = await request.get("/api/v1/customers?limit=100", { headers: auth(salesToken) });
    expect(mine.status()).toBe(200);
    const rows = (await mine.json()).items ?? (await mine.json()).data ?? [];

    const all = await request.get("/api/v1/customers?limit=100", { headers: auth(adminToken) });
    expect(all.status()).toBe(200);

    // Every row a salesperson sees must belong to that salesperson.
    const me = JSON.parse(
      Buffer.from(salesToken.split(".")[1], "base64").toString("utf8"),
    ).sub as string;
    for (const r of rows) {
      if (r.salespersonId) expect(r.salespersonId, `row ${r.id} leaked to sales`).toBe(me);
    }
  });

  test("a salesperson reads their own sales target and nobody else's", async ({ request }) => {
    // The dashboard has always shown a salesperson their own target figure —
    // it reads under `projection.read`, which sales holds. The targets list
    // read under `report.view`, which sales does not, so the same fact was
    // published in one place and 403'd in the other, and the sales branch of
    // the service's owner scoping could not be reached over HTTP at all.
    const salesToken = await apiToken(request, "sales");
    const me = JSON.parse(
      Buffer.from(salesToken.split(".")[1], "base64").toString("utf8"),
    ).sub as string;

    const mine = await request.get("/api/v1/targets", { headers: auth(salesToken) });
    expect(mine.status()).toBe(200);
    const rows = await mine.json();
    for (const r of rows) {
      expect(r.salespersonId, `target for ${r.salespersonName} leaked to sales`).toBe(me);
    }

    // Asking for somebody else by name does not widen it — the server decides.
    const adminToken = await apiToken(request, "admin");
    const all = await request.get("/api/v1/targets", { headers: auth(adminToken) });
    const other = (await all.json()).find(
      (r: { salespersonId: string }) => r.salespersonId !== me,
    );
    if (other) {
      const asked = await request.get(
        `/api/v1/targets?salespersonId=${other.salespersonId}`,
        { headers: auth(salesToken) },
      );
      expect(asked.status()).toBe(200);
      for (const r of await asked.json()) expect(r.salespersonId).toBe(me);
    }
  });

  test("a salesperson still cannot SET a target", async ({ request }) => {
    const token = await apiToken(request, "sales");
    const me = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString("utf8"),
    ).sub as string;
    const res = await request.put("/api/v1/targets", {
      headers: auth(token),
      data: { salespersonId: me, period: "2026-01", targetValue: 1 },
    });
    // Lowering the number you are measured against is `target.manage`, and
    // sales does not hold it — not even for their own row.
    expect([401, 403], `got ${res.status()}`).toContain(res.status());
  });

  test("sales token is refused on an admin-only write endpoint", async ({ request }) => {
    const token = await apiToken(request, "sales");
    const res = await request.post("/api/v1/products", {
      headers: auth(token),
      data: { name: "QA should never be created", principalId: "principal_x" },
    });
    expect([401, 403], `got ${res.status()}`).toContain(res.status());
  });

  test("a user of one tenant cannot log into another tenant", async ({ request }) => {
    const res = await request.post("/api/v1/auth/login", {
      data: {
        tenantId: "tenant_does_not_exist",
        email: CREDENTIALS.admin.email,
        password: CREDENTIALS.admin.password,
      },
    });
    expect(res.status(), "wrong tenant must not authenticate").toBeGreaterThanOrEqual(400);
  });

  test("the tenant claim in the token is what scopes reads, not a query parameter", async ({
    request,
  }) => {
    const token = await apiToken(request, "admin");
    const res = await request.get("/api/v1/customers?limit=5&tenantId=tenant_other", {
      headers: auth(token),
    });
    // Either the parameter is rejected outright or it is ignored — never honoured.
    if (res.status() === 200) {
      const body = await res.json();
      const rows = body.items ?? body.data ?? [];
      for (const r of rows) {
        if (r.tenantId) expect(r.tenantId).toBe(TENANT);
      }
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  });
});
