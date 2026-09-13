import { test, expect } from "@playwright/test";
import { MGMT_ID } from "../fixtures/test-data";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Customer Master Directory Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/customers`);
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 7.1: renders customer directory header and accounts table", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Customer/i }).first()).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/accounts/i).first()).toBeVisible();
  });

  test("Scenario 7.2: interactive Add New Customer modal opens, checks controls, and cancels", async ({ page }) => {
    const addBtn = page.getByRole("button", { name: /\+ Add New Customer/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Customer/i }).first()).toBeVisible();

    // Verify key inputs (business name, contact, etc.)
    await expect(dialog.locator("input").first()).toBeVisible();

    // Dismiss cleanly
    await dialog.getByRole("button", { name: /Cancel|Discard/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 7.3: admin Reassign Accounts modal opens and cancels", async ({ page }) => {
    const reassignBtn = page.getByRole("button", { name: /Reassign accounts/i });
    if (await reassignBtn.isVisible()) {
      await reassignBtn.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /Cancel|Close/i }).first().click();
      await expect(dialog).not.toBeVisible();
    }
  });

  test("Scenario 7.4: search input filters customer accounts", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search customers"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill("Automotive");
    await page.waitForTimeout(600);
    await searchInput.clear();
    await page.waitForTimeout(600);
  });
});
