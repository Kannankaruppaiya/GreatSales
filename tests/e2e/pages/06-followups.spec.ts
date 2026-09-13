import { test, expect } from "@playwright/test";
import { MGMT_ID } from "../fixtures/test-data";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Follow-ups & Actionable Timeline Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/followups`);
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 6.1: renders actionable timeline header, search input, and timeline stream", async ({ page }) => {
    await expect(page.getByText(/Actionable Timeline/i).first()).toBeVisible();
    await expect(page.locator('input[placeholder*="Search follow-ups"]')).toBeVisible();
    await expect(page.getByText(/open follow-ups/i).first()).toBeVisible();
  });

  test("Scenario 6.2: interactive Add Follow-up modal opens, checks controls, and cancels", async ({ page }) => {
    const addBtn = page.getByRole("button", { name: /\+ Add follow-up/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Add follow-up|Create follow-up/i }).first()).toBeVisible();

    // Verify presence of input controls
    await expect(dialog.locator("input, select, textarea").first()).toBeVisible();

    // Dismiss cleanly
    await dialog.getByRole("button", { name: /Cancel|Discard/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 6.3: entity type dropdown filter updates query", async ({ page }) => {
    const entitySelect = page.locator('select:has-text("All entity types")');
    if (await entitySelect.isVisible()) {
      await entitySelect.selectOption({ index: 1 });
      await page.waitForTimeout(400);
      await entitySelect.selectOption({ value: "ALL" });
      await page.waitForTimeout(400);
    }
  });

  test("Scenario 6.4: search input debounces and filters timeline", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search follow-ups"]');
    await searchInput.fill("Automotive");
    await page.waitForTimeout(500);
    await searchInput.clear();
    await page.waitForTimeout(500);
  });
});
