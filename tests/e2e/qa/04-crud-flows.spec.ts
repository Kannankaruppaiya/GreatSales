import { test, expect, type Page } from "@playwright/test";
import { apiToken, auth, featureUrl, loginAs, unique } from "../helpers/session";

/**
 * Write paths for the remaining features: each record is created through the
 * real modal, its POST is asserted, the row is looked for on the page, and the
 * record is deleted through the API afterwards so the Promech dataset is
 * returned to the state the run found it in.
 *
 * Name buttons by the words on them and nothing else. Every test in this file
 * once opened its modal with a name like `/\+ Add Invoice/` — but that "+" is
 * a lucide icon, which contributes nothing to a button's accessible name, so
 * the locator matched no button at all. Playwright has no default action
 * timeout, so the click waited for an element that was never coming and the
 * test died on its own 30s limit with no locator named in the failure. Five
 * tests here failed that way, and the API they were meant to be exercising was
 * working the whole time.
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

    await page.getByRole("button", { name: /Add New Sales Lead/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(/Acme Precision Tools/i).fill(name);
    // A lead names its people in a contact list now, not four flat fields: the
    // first card is the primary, and a designation has a column of its own
    // instead of being crammed into the name in brackets.
    await dialog.locator("#contact-name-0").fill("QA Contact");
    await dialog.locator("#contact-designation-0").fill("Purchase Manager");
    await dialog.locator("#contact-phone-0").fill("+91 90000 00001");

    await submitAndTrack(page, /Create Lead/i, "leads");
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder("Search new sales pipeline…").fill(name);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 });
  });

  test("payment: record an invoice and see it in the ledger after a reload", async ({ page }) => {
    const ref = unique("QAREF").replace(/\s/g, "/");
    await loginAs(page, "admin");
    await page.goto(featureUrl("payments"));

    await page.getByRole("button", { name: /Add Invoice/i }).click();
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

  test("payment: the reminder chase goes out in order, and comes back", async ({
    page,
    request,
  }) => {
    // Its own invoice, not a seeded one: this test writes reminder state, and
    // the Promech rows are what every other assertion in the sweep reads.
    const token = await apiToken(request, "admin");
    const ref = unique("QACHASE").replace(/\s/g, "/");
    const created = await request.post("/api/v1/payments", {
      headers: auth(token),
      data: { refNo: ref, customerName: "QA Chase Party", amount: 5000 },
    });
    expect(created.status()).toBe(201);
    const payment = await created.json();
    trash.push({ resource: "payments", id: payment.id });

    await loginAs(page, "admin");
    await page.goto(featureUrl("payments"));
    await page.getByPlaceholder("Search party or ref no…").fill(ref);

    const trigger = page.getByRole("button", { name: new RegExp(`Reminders for ${ref}`) });
    await expect(trigger).toHaveText(/No reminder/);
    await trigger.click();

    // Only the first letter is on offer; the rest wait their turn.
    const items = page.getByRole("menuitem");
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toBeEnabled();
    await expect(items.nth(1)).toBeDisabled();
    await expect(items.nth(3)).toBeDisabled();

    const sent = page.waitForResponse(
      (r) => r.url().includes(`/payments/${payment.id}`) && r.request().method() === "PATCH",
    );
    await items.nth(0).click();
    expect((await sent).status()).toBe(200);
    await expect(trigger).toHaveText(/1st sent/);

    // The API stamped the date; the client never sent one.
    const after = await request.get(`/api/v1/payments?search=${encodeURIComponent(ref)}`, {
      headers: auth(token),
    });
    const row = (await after.json()).items[0];
    expect(row.mail1).toBe(true);
    expect(row.mail1At).not.toBeNull();
    expect(row.mail2At).toBeNull();

    // And a letter marked in error can be taken back — the four chips this
    // menu replaced had no way to unmark one.
    await trigger.click();
    const undone = page.waitForResponse(
      (r) => r.url().includes(`/payments/${payment.id}`) && r.request().method() === "PATCH",
    );
    await page.getByRole("menuitem").nth(0).click();
    expect((await undone).status()).toBe(200);
    await expect(trigger).toHaveText(/No reminder/);
  });

  test("product: add a catalog SKU and find it by search", async ({ page }) => {
    const name = unique("QA Grade Lubricant");
    await loginAs(page, "admin");
    await page.goto(featureUrl("products"));

    await page.getByRole("button", { name: /Add Product/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(/Castrol Magnatec/i).fill(name);

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

    await page.getByRole("button", { name: /Add Follow-Up/i }).click();
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

    await page.getByRole("button", { name: /Create Sales Order/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The form arrives EMPTY. It used to open on the first customer and the
    // first product alphabetically — a choice nobody made, one click from
    // raising a real order against whoever it landed on — and it also carried
    // the account and SKU of the order raised before it, because the modal
    // stays mounted while closed.
    const soNumber = dialog.getByPlaceholder("SO-1001");
    const submit = dialog.getByRole("button", { name: /Create Sales Order/i });
    await expect(dialog.locator("#so-customer")).toHaveValue("");
    await expect(dialog.locator("#so-product")).toHaveValue("");
    await expect(submit, "an order with no account chosen must not be submittable").toBeDisabled();

    await dialog.locator("#so-customer").selectOption({ index: 1 });
    await dialog.locator("#so-product").selectOption({ index: 1 });
    await dialog.locator("#so-salesperson").selectOption({ index: 1 });

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
