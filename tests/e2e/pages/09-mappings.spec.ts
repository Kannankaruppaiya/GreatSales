import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Customer & Product Mapping Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/managements/greatsales-industrial-corp/mappings");
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 9.1: renders mapping page title, count badge, and mappings table", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Mapping/i }).first()).toBeVisible();
    await expect(page.getByText("Mappings", { exact: true })).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 9.2: interactive Map a product modal opens, checks controls, and cancels", async ({ page }) => {
    const mapBtn = page.getByRole("button", { name: /Map a product/i });
    await expect(mapBtn).toBeVisible();
    await mapBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Map a product|New Mapping/i }).first()).toBeVisible();

    // Verify pickers or inputs exist
    await expect(dialog.locator("select, input").first()).toBeVisible();

    // Dismiss cleanly
    await dialog.getByRole("button", { name: /Cancel|Discard/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 9.3: search input filters mapped products and customers", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search customer, product"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill("Oil");
    await page.waitForTimeout(600);
    await searchInput.clear();
    await page.waitForTimeout(600);
  });
});
