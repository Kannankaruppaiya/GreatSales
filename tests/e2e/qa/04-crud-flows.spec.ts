import { test, expect, type Page } from "@playwright/test";
import { apiToken, auth, featureUrl, loginAs, unique } from "../helpers/session";

/**
 * Write paths for the remaining features: each record is created through the
 * real modal, its POST is asserted, the row is looked for on the page, and the
 * record is deleted through the API afterwards so the Promech dataset is
 * returned to the state the run found it in.
 */

type Trash = { resource: string; id: string };
const trash: Trash[] = [];

test.afterAll(async ({ playwright, baseURL }) => {
  if (trash.length === 0) return;
  const ctx = await playwright.request.newContext({ baseURL });
  const token = await apiToken(ctx, "admin");
  for (const t of trash.reverse()) {
    await ctx.delete(`/api/v1/${t.resource}/${t.id}`, { headers: auth(token) });
  }
  await ctx.dispose();
});

/** Click the submit button and assert the POST it fires was accepted. */
async function submitAndTrack(page: Page, buttonName: RegExp, resource: string) {
  const post = page.waitForResponse(
    (r) => r.url().includes(`/api/v1/${resource}`) && r.request().method() === "POST",
  );
  await page.getByRole("dialog").getByRole("button", { name: buttonName }).click();
  const res = await post;
  expect(res.status(), `POST /${resource} → ${res.status()}: ${await res.text()}`).toBe(201);
  const body = await res.json();
  if (body?.id) trash.push({ resource, id: body.id });
  return body;
}

test.describe("Write paths", () => {
  test("lead: create from the pipeline page and find it in list view", async ({ page }) => {
    const name = unique("Falcon Hydraulics");
    await loginAs(page, "admin");
    await page.goto(featureUrl("leads"));

    await page.getByRole("button", { name: /\+ Add New Sales Lead/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(/Acme Precision Tools/i).fill(name);
    await dialog.getByPlaceholder(/Mr. Raja/i).fill("QA Contact");
    await dialog.getByPlaceholder(/\+91 98400 12345/i).first().fill("+91 90000 00001");

    await submitAndTrack(page, /Create Lead/i, "leads");
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder("Search new sales pipeline…").fill(name);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 });
  });

  test("payment: record an invoice and see it in the ledger after a reload", async ({ page }) => {
    const ref = unique("QAREF").replace(/\s/g, "/");
    await loginAs(page, "admin");
    await page.goto(featureUrl("payments"));

    await page.getByRole("button", { name: /\+ Add Invoice/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(/PMTPL\/1842/i).fill(ref);
    await dialog.getByPlaceholder(/Anand Automotive/i).fill("QA Automation Party");
    await dialog.getByPlaceholder("0").first().fill("12345");

    await submitAndTrack(page, /Save Invoice/i, "payments");
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.reload();
    await page.getByPlaceholder("Search party or ref no…").fill(ref);
    await expect(page.getByText(ref).first()).toBeVisible({ timeout: 15000 });
  });

  test("product: add a catalog SKU and find it by search", async ({ page }) => {
    const name = unique("QA Grade Lubricant");
    await loginAs(page, "admin");
    await page.goto(featureUrl("products"));

    await page.getByRole("button", { name: /Add Product/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(/Hysol MB 50/i).fill(name);

    await submitAndTrack(page, /Add Product|Create Product|Save/i, "products");
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder("Search catalog by name or SKU…").fill(name);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 });
  });

  test("follow-up: create against a real customer and see it on the timeline", async ({
    page,
    request,
  }) => {
    const token = await apiToken(request, "admin");
    const list = await request.get("/api/v1/customers?limit=1", { headers: auth(token) });
    const body = await list.json();
    const customer = (body.items ?? body.data)[0];
    const title = unique("QA Follow-up");

    await loginAs(page, "admin");
    await page.goto(featureUrl("followups"));

    await page.getByRole("button", { name: /\+ Add follow-up/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(/cust_1, lead_2/i).fill(customer.id);
    await dialog.getByPlaceholder(/Anand Automotive Systems · CN-42 Oil/i).fill(title);

    await submitAndTrack(page, /Create Follow-Up/i, "followups");
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder("Search follow-ups…").fill(title);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 });
  });

  test("mapping: map a product to a customer through the grid", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("mappings"));

    await page.getByRole("button", { name: /Map a product/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#mapping-customer")).toBeEnabled();
    await expect(dialog.locator("#mapping-product")).toBeEnabled();
    await dialog.locator("#mapping-price").fill("999");

    const post = page.waitForResponse(
      (r) => r.url().includes("/api/v1/mappings") && r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: /Create mapping/i }).click();
    const res = await post;

    // A duplicate pair is a legitimate 409 — the seed already maps 883 of them.
    expect([201, 409], `mapping POST → ${res.status()}`).toContain(res.status());
    if (res.status() === 201) trash.push({ resource: "mappings", id: (await res.json()).id });
  });

  test("order: the prefilled form creates a real sales order, and validates its code", async ({
    page,
  }) => {
    const code = unique("SO").replace(/\s/g, "-");
    await loginAs(page, "admin");
    await page.goto(featureUrl("orders"));

    await page.getByRole("button", { name: /\+ Create Sales Order/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The form arrives prefilled (first customer, first product, qty 10), so the
    // only required field a person must supply is the SO number — clearing it
    // must block the submit.
    const soNumber = dialog.getByPlaceholder("SO-1001");
    const submit = dialog.getByRole("button", { name: /Create Sales Order/i });
    await soNumber.fill("");
    await expect(submit, "an order with no SO number must not be submittable").toBeDisabled();

    await soNumber.fill(code);
    await expect(submit).toBeEnabled();

    await submitAndTrack(page, /Create Sales Order/i, "orders");
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder("Search SO no., customer, or transporter…").fill(code);
    await expect(page.getByText(code).first()).toBeVisible({ timeout: 10000 });
  });

});
