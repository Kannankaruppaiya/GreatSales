import { test, expect } from "@playwright/test";
import { apiToken, auth, featureUrl, loginAs, watchErrors } from "../helpers/session";

/**
 * How the app behaves when things are not ideal: a session that ends, a
 * network that fails, a server that is slow, a second click on a submit
 * button, a small screen. None of these should lose the user's place or
 * silently swallow the failure.
 */
test.describe("Resilience & session", () => {
  test("a reload keeps the session — the refresh cookie restores the workspace", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("customers"));
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });

    await page.reload();
    await expect(page.locator("aside")).toBeVisible({ timeout: 15000 });
    expect(page.url(), "must not be bounced to login on reload").toContain("/customers");
  });

  test("after logout the back button cannot restore the workspace", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("customers"));
    await page.locator('button[title="Sign out"]').click();
    await page.waitForURL(/\/login/, { timeout: 15000 });

    await page.goBack();
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page.locator("#login-email")).toBeVisible();
  });

  test("a session whose refresh fails is sent to login, not left on a broken page", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("customers"));
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });

    // Every call from here on behaves as an expired session.
    await page.route("**/api/v1/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ statusCode: 401, error: "Unauthorized", message: "Token expired" }),
      }),
    );

    await page.reload();
    await page.waitForURL(/\/login/, { timeout: 20000 });
    await expect(page.locator("#login-email")).toBeVisible();
  });

  test("a dead network surfaces the failure and recovers when it comes back", async ({ page }) => {
    await loginAs(page, "admin");

    let down = true;
    await page.route("**/api/v1/customers*", async (route) => {
      if (down) return route.abort("failed");
      return route.fallback();
    });

    await page.goto(featureUrl("customers"));
    await expect(page.getByText(/Failed to load:/i)).toBeVisible({ timeout: 20000 });
    // The shell survives the failure.
    await expect(page.locator("aside")).toBeVisible();

    down = false;
    await page.getByRole("button", { name: /Refresh/i }).click();
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 20000 });
  });

  test("a slow response shows a loading state instead of an empty page", async ({ page }) => {
    await loginAs(page, "admin");
    await page.route("**/api/v1/customers*", async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.fallback();
    });

    await page.goto(featureUrl("customers"));
    // Something must be on screen while the request is in flight.
    await expect(
      page.getByRole("heading", { name: "Customer Master Directory" }).first(),
    ).toBeVisible();
    await expect(page.getByText(/No customer accounts found/i)).toHaveCount(0);
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 20000 });
  });

  test("double-clicking Create does not create the record twice", async ({ page, request }) => {
    const name = `QA Double Click ${Date.now().toString(36)}`;
    const posts: string[] = [];
    await loginAs(page, "admin");
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/api/v1/customers")) posts.push(r.url());
    });

    await page.goto(featureUrl("customers"));
    await page.getByRole("button", { name: /Add Customer/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/Anand Automotive/i).fill(name);

    const submit = dialog.getByRole("button", { name: /Create Customer/i });
    await submit.click();
    await submit.click({ force: true, timeout: 2000 }).catch(() => {
      /* the button is disabled or gone by now — that is the point */
    });
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    const token = await apiToken(request, "admin");
    const res = await request.get(`/api/v1/customers?limit=50&search=${encodeURIComponent(name)}`, {
      headers: auth(token),
    });
    const items = (await res.json()).items ?? [];
    expect(items.length, "a second click must not create a second customer").toBe(1);
    await request.delete(`/api/v1/customers/${items[0].id}`, { headers: auth(token) });
  });

  test("the workspace is usable on a phone-sized screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const watch = watchErrors(page);
    await loginAs(page, "admin");
    await page.goto(featureUrl("customers"));

    await expect(
      page.getByRole("heading", { name: "Customer Master Directory" }).first(),
    ).toBeVisible({ timeout: 15000 });
    // Nothing may spill sideways out of the viewport.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "page must not scroll horizontally on a phone").toBeLessThanOrEqual(1);
    watch.assertClean();
  });

  test("the command palette navigates to the feature it names", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("dashboard"));

    await page.locator('button:has-text("Search anything")').first().click();
    const palette = page.getByRole("dialog");
    await expect(palette).toBeVisible({ timeout: 10000 });

    // The palette has no arrow-key/Enter selection — results are buttons.
    await palette.getByPlaceholder(/Type a command/i).fill("Payments");
    await palette.getByRole("button", { name: /Payments Follow-Up/i }).first().click();

    await page.waitForURL(/\/payments/, { timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "Payments & Receivables Follow-up" }).first(),
    ).toBeVisible();
  });

  test("a palette product hit lands inside the workspace, not on a dead root route", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("dashboard"));

    await page.locator('button:has-text("Search anything")').first().click();
    const palette = page.getByRole("dialog");
    await expect(palette).toBeVisible({ timeout: 10000 });
    await palette.getByPlaceholder(/Type a command/i).fill("oil");

    const productHit = palette.locator("button").filter({ hasText: /SKU|₹/ }).first();
    await expect(productHit).toBeVisible({ timeout: 10000 });
    await productHit.click();

    // Bare "/products" is not a route: it falls through to the root redirect.
    await expect(page).toHaveURL(/\/managements\/[^/]+\/(products|customers)/, {
      timeout: 10000,
    });
  });

  test("Ctrl+K opens the palette and Escape closes it", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("dashboard"));
    await expect(page.locator("aside")).toBeVisible();
    await page.locator("body").click({ position: { x: 5, y: 5 } });

    await page.keyboard.press("Control+KeyK");
    const palette = page.getByRole("dialog");
    await expect(palette, "Ctrl+K must open the command palette").toBeVisible({ timeout: 10000 });

    await page.keyboard.press("Escape");
    await expect(palette).not.toBeVisible({ timeout: 10000 });
  });

  test("an unknown top-level route tells an anonymous visitor nothing", async ({ page }) => {
    await page.goto("/definitely-not-a-route");
    // The catch-all sits behind ProtectedRoute, and a path with no role segment
    // has no door to send anyone to. It used to be asserted that this lands on
    // /login; there is deliberately no shared sign-in page any more — offering
    // one would put every portal a click from the administrator's — so the app
    // says so in place, without moving and without naming the four addresses.
    await expect(page.getByText(/not a sign-in address/i)).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#login-email")).toHaveCount(0);
  });
});
