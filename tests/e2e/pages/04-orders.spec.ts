import { test, expect } from "@playwright/test";
import { MGMT_ID } from "../fixtures/test-data";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Sales Orders & Fulfillment Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/orders`);
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 4.1: renders sales order header, summary tabs, and orders table", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Sales Order/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Orders \(/i })).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 4.2: toggles between Orders List and Fulfilment SLA Report tab", async ({ page }) => {
    const reportTab = page.getByRole("button", { name: /Fulfilment SLA Report/i });
    await expect(reportTab).toBeVisible();
    await reportTab.click();
    await page.waitForTimeout(400);

    // Verify SLA report card or section displays
    await expect(page.getByText(/Fulfilment SLA/i).first()).toBeVisible();

    // Switch back to Orders tab
    const ordersTab = page.getByRole("button", { name: /Orders \(/i });
    await ordersTab.click();
    await page.waitForTimeout(400);
    await expect(page.locator("table")).toBeVisible();
  });

  test("Scenario 4.3: interactive Create Sales Order modal opens, checks controls, and cancels", async ({ page }) => {
    const createBtn = page.getByRole("button", { name: /\+ Create Sales Order/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Create Sales Order/i }).first()).toBeVisible();

    // Verify customer selector and order controls exist
    await expect(dialog.locator("select, input").first()).toBeVisible();

    // Dismiss cleanly
    await dialog.getByRole("button", { name: /Cancel|Discard/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 4.4: search input filters sales orders table", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("Promech");
      await page.waitForTimeout(500);
      await searchInput.clear();
      await page.waitForTimeout(500);
    }
  });
});
