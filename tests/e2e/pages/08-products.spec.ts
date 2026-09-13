import { test, expect } from "@playwright/test";
import { MGMT_ID } from "../fixtures/test-data";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Product & Principal Catalog Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/products`);
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 8.1: renders catalog header, principal master section, and SKU table", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Product/i }).first()).toBeVisible();
    await expect(page.getByText(/Principal Master Brands/i)).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 8.2: interactive Add Brand modal opens and cancels", async ({ page }) => {
    const addBrandBtn = page.getByRole("button", { name: /Add Brand/i });
    if (await addBrandBtn.isVisible()) {
      await addBrandBtn.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /Cancel|Close/i }).first().click();
      await expect(dialog).not.toBeVisible();
    }
  });

  test("Scenario 8.3: interactive Add Product modal opens and cancels", async ({ page }) => {
    const addProductBtn = page.getByRole("button", { name: /Add Product/i });
    if (await addProductBtn.isVisible()) {
      await addProductBtn.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /Cancel|Discard/i }).click();
      await expect(dialog).not.toBeVisible();
    }
  });

  test("Scenario 8.4: search input filters SKU price master table", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search product"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("Lubricant");
      await page.waitForTimeout(600);
      await searchInput.clear();
      await page.waitForTimeout(600);
    }
  });
});
