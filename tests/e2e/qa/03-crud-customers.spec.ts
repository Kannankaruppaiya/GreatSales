import { test, expect } from "@playwright/test";
import { apiToken, auth, featureUrl, loginAs, unique, watchErrors } from "../helpers/session";

/**
 * The customer record end to end: created through the real form, found in the
 * list, still there after a reload (so it was persisted, not just optimistic),
 * edited, and finally removed through the API so the dataset is left as found.
 */
test.describe("Customer lifecycle", () => {
  const created: string[] = [];

  test.afterAll(async ({ playwright, baseURL }) => {
    if (created.length === 0) return;
    const ctx = await playwright.request.newContext({ baseURL });
    const token = await apiToken(ctx, "admin");
    for (const id of created) {
      await ctx.delete(`/api/v1/customers/${id}`, { headers: auth(token) });
    }
    await ctx.dispose();
  });

  test("create → appears in list → survives reload → edit → persists", async ({ page, request }) => {
    const watch = watchErrors(page);
    const name = unique("Zephyr Precision");
    const renamed = `${name} (Renamed)`;

    await loginAs(page, "admin");
    await page.goto(featureUrl("customers"));

    await page.getByRole("button", { name: /\+ Add New Customer/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder(/Anand Automotive/i).fill(name);
    await dialog.getByPlaceholder(/Tier-1 Engine/i).fill("QA Automation Sub-industry");

    const createRes = page.waitForResponse(
      (r) => r.url().includes("/api/v1/customers") && r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: /Create Customer/i }).click();
    const res = await createRes;
    expect(res.status(), "create must be accepted").toBe(201);
    created.push((await res.json()).id);

    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Search narrows to the new row without a manual refresh.
    const search = page.getByPlaceholder("Search customers…");
    await search.fill(name);
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible({ timeout: 10000 });

    // A full reload proves it was written, not just cached in the client.
    await page.reload();
    await page.getByPlaceholder("Search customers…").fill(name);
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible({ timeout: 15000 });

    // Edit it.
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog).toBeVisible();
    await editDialog.getByPlaceholder("Company name…").fill(renamed);

    const patch = page.waitForResponse(
      (r) => r.url().includes("/api/v1/customers/") && r.request().method() === "PATCH",
    );
    await editDialog.getByRole("button", { name: /Save Changes/i }).click();
    expect((await patch).status()).toBe(200);
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });

    await page.reload();
    await page.getByPlaceholder("Search customers…").fill(renamed);
    await expect(page.getByRole("button", { name: renamed, exact: true })).toBeVisible({
      timeout: 15000,
    });

    watch.assertClean();
  });

  test("the 360 drawer opens on the row and shows that customer", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("customers"));
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });

    const firstName = (await page.locator("table tbody tr").first().locator("td").first().innerText())
      .trim();
    await page.getByRole("button", { name: "360 View" }).first().click();

    // The 360 slide-over is a plain panel (no dialog role — see the a11y note in
    // the QA report), so it is identified by the customer heading it renders.
    await expect(
      page.getByRole("heading", { level: 3, name: firstName, exact: true }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("search that matches nothing shows the empty state, not a broken table", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("customers"));
    await page.getByPlaceholder("Search customers…").fill("zzz-no-such-customer-zzz");
    await expect(page.getByText(/No customer accounts found/i)).toBeVisible({ timeout: 10000 });
  });

  test("a script payload in the search box is treated as text, never executed", async ({ page }) => {
    const watch = watchErrors(page);
    await loginAs(page, "admin");
    await page.goto(featureUrl("customers"));

    let alerted = false;
    page.on("dialog", async (d) => {
      alerted = true;
      await d.dismiss();
    });

    await page.getByPlaceholder("Search customers…").fill('<img src=x onerror=alert(1)>');
    await page.waitForTimeout(1000);
    expect(alerted, "search input must not execute markup").toBe(false);
    watch.assertClean();
  });

  test("an over-long name is rejected by the API rather than stored", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const res = await request.post("/api/v1/customers", {
      headers: auth(token),
      data: { name: "x".repeat(5000), salespersonId: "user_megala", division: "LUB" },
    });
    if (res.status() === 201) created.push((await res.json()).id); // clean up what slipped through
    expect(res.status(), "5000-char name must not be accepted").toBeGreaterThanOrEqual(400);
  });

  test("creating without a name is refused by the API, not only by the disabled button", async ({
    request,
  }) => {
    const token = await apiToken(request, "admin");
    const res = await request.post("/api/v1/customers", {
      headers: auth(token),
      data: { salespersonId: "user_megala", division: "LUB" },
    });
    expect(res.status()).toBe(400);
  });
});
