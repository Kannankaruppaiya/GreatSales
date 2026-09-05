import { test, expect } from "@playwright/test";
import { apiToken, auth, featureUrl, loginAs, unique, watchErrors } from "../helpers/session";

/**
 * The two surfaces where a mistake costs the most: the projection worksheet
 * (the committed/achieved numbers the business runs on) and user governance
 * (who can do what). Both are edited in place, so the checks follow the value
 * from the cell to the API and back after a reload.
 */
const NUMBER_CELL = 'table tbody tr input[type="number"]';

/**
 * The seeded Promech worksheet is the June 2026 dataset, while the page opens
 * on a hardcoded "2026-08" (see ProjectionsPage) which has no lines at all —
 * so every worksheet test picks the period explicitly first.
 */
const SEEDED_PERIOD = "2026-06";

async function openWorksheet(page: import("@playwright/test").Page) {
  await page.goto(featureUrl("projections"));
  await page.getByLabel("Filter by month").selectOption(SEEDED_PERIOD);
  await expect(page.locator(NUMBER_CELL).first()).toBeVisible({ timeout: 20000 });
}

test.describe("Projection worksheet", () => {
  test("an achieved quantity typed into a cell is saved and survives a reload", async ({
    page,
  }) => {
    const watch = watchErrors(page);
    await loginAs(page, "admin");
    await openWorksheet(page);

    const cell = page.locator(NUMBER_CELL).first();
    const original = await cell.inputValue();
    const next = String((Number(original) || 0) + 7);

    const patch = page.waitForResponse(
      (r) => r.url().includes("/api/v1/projections") && r.request().method() === "PATCH",
    );
    await cell.fill(next);
    await cell.press("Enter");
    expect((await patch).status(), "the cell edit must reach the API").toBe(200);

    await openWorksheet(page);
    await expect(page.locator(NUMBER_CELL).first()).toHaveValue(next);

    // Put the row back the way it was found.
    const restore = page.waitForResponse(
      (r) => r.url().includes("/api/v1/projections") && r.request().method() === "PATCH",
    );
    const cellAgain = page.locator(NUMBER_CELL).first();
    await cellAgain.fill(original);
    await cellAgain.press("Enter");
    await restore;

    watch.assertClean();
  });

  test("changing the line status writes it through and re-renders the badge", async ({ page }) => {
    await loginAs(page, "admin");
    await openWorksheet(page);

    const status = page.locator("table tbody tr select").first();
    const original = await status.inputValue();
    const next = original === "Confirmed" ? "Lost" : "Confirmed";

    const patch = page.waitForResponse(
      (r) => r.url().includes("/api/v1/projections") && r.request().method() === "PATCH",
    );
    await status.selectOption(next);
    expect((await patch).status()).toBe(200);
    await expect(status).toHaveValue(next);

    const restore = page.waitForResponse(
      (r) => r.url().includes("/api/v1/projections") && r.request().method() === "PATCH",
    );
    await status.selectOption(original);
    await restore;
  });

  test("the topbar month drives the worksheet, not just its initial render", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("projections"));

    // A month with no seeded lines, then the one that has them: the table must
    // follow both times, not only the value present when the page mounted.
    await page.getByLabel("Filter by month").selectOption("2026-08");
    await expect(page.getByText(/No projection lines for this period/i)).toBeVisible({
      timeout: 20000,
    });

    await page.getByLabel("Filter by month").selectOption(SEEDED_PERIOD);
    await expect(page.locator(NUMBER_CELL).first()).toBeVisible({ timeout: 20000 });
  });

  test("the API refuses a status value that is not in the enum", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const list = await request.get(`/api/v1/projections?limit=1&period=${SEEDED_PERIOD}`, {
      headers: auth(token),
    });
    const body = await list.json();
    const line = (body.items ?? body.lines ?? body.data ?? [])[0];
    test.skip(!line, "no projection lines seeded for this period");

    const res = await request.patch(`/api/v1/projections/${line.id}`, {
      headers: auth(token),
      data: { status: "TotallyMadeUp" },
    });
    expect(res.status()).toBe(400);
  });

  test("a negative achieved quantity is refused", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const list = await request.get(`/api/v1/projections?limit=1&period=${SEEDED_PERIOD}`, {
      headers: auth(token),
    });
    const body = await list.json();
    const line = (body.items ?? body.lines ?? body.data ?? [])[0];
    test.skip(!line, "no projection lines seeded for this period");

    const res = await request.patch(`/api/v1/projections/${line.id}`, {
      headers: auth(token),
      data: { achievedQty: -50 },
    });
    expect(res.status(), "negative achieved quantity must not be stored").toBeGreaterThanOrEqual(
      400,
    );
  });
});

test.describe("User governance", () => {
  test("the three tabs render and the users directory lists the seeded accounts", async ({
    page,
  }) => {
    const watch = watchErrors(page);
    await loginAs(page, "admin");
    await page.goto(featureUrl("users"));

    await expect(page.getByRole("tab", { name: "Users" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("admin@greatsales.local").first()).toBeVisible();

    for (const tab of ["Roles", "Teams"]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    }
    watch.assertClean();
  });

  test("a created user can sign in, and is gone after deletion", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const username = `qa${Date.now().toString(36)}`;
    const email = `${username}@greatsales.local`;
    const password = "QaPassw0rd!2026";

    const roles = await request.get("/api/v1/roles", { headers: auth(token) });
    const roleBody = await roles.json();
    const roleList = roleBody.items ?? roleBody.data ?? roleBody;
    const salesRole = roleList.find((r: { name: string }) => r.name === "sales") ?? roleList[0];

    const created = await request.post("/api/v1/users", {
      headers: auth(token),
      data: { name: unique("QA User"), email, username, password, roleId: salesRole.id },
    });
    expect(created.status(), await created.text()).toBe(201);
    const user = await created.json();

    // The new account authenticates with exactly the credentials it was given.
    const login = await request.post("/api/v1/auth/login", {
      data: { tenantId: "tenant_promech", email, password },
    });
    expect(login.status(), "a created user must be able to log in").toBe(201);

    // …and not with a wrong one.
    const bad = await request.post("/api/v1/auth/login", {
      data: { tenantId: "tenant_promech", email, password: password + "x" },
    });
    expect(bad.status()).toBeGreaterThanOrEqual(400);

    const removed = await request.delete(`/api/v1/users/${user.id}`, { headers: auth(token) });
    expect([200, 204]).toContain(removed.status());

    const afterDelete = await request.post("/api/v1/auth/login", {
      data: { tenantId: "tenant_promech", email, password },
    });
    expect(
      afterDelete.status(),
      "a deleted user must not be able to log in",
    ).toBeGreaterThanOrEqual(400);
  });

  test("a duplicate username is rejected rather than shadowing the existing account", async ({
    request,
  }) => {
    const token = await apiToken(request, "admin");
    const roles = await request.get("/api/v1/roles", { headers: auth(token) });
    const roleBody = await roles.json();
    const roleList = roleBody.items ?? roleBody.data ?? roleBody;
    const salesRole = roleList.find((r: { name: string }) => r.name === "sales") ?? roleList[0];

    const res = await request.post("/api/v1/users", {
      headers: auth(token),
      data: {
        name: "Duplicate Admin",
        email: "admin@greatsales.local",
        username: "admin",
        password: "QaPassw0rd!2026",
        roleId: salesRole.id,
      },
    });
    expect(res.status(), "duplicate email/username must be refused").toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});
