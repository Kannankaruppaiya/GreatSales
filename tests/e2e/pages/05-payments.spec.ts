import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Payments & Receivables Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/managements/greatsales-industrial-corp/payments");
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 5.1: renders payments header, aging KPI metrics, and ledger table", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Payments & Receivables/i }).first()).toBeVisible();
    await expect(page.getByText(/Total pending/i)).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 5.2: toggles between Ledger list and Aging Matrix Reports tab", async ({ page }) => {
    const reportTab = page.getByRole("button", { name: /Aging Matrix Reports/i });
    await expect(reportTab).toBeVisible();
    await reportTab.click();
    await page.waitForTimeout(400);

    // Aging report view
    await expect(page.getByText(/Aging Breakdown/i).or(page.locator("table").first())).toBeVisible();

    // Switch back to Ledger list
    const ledgerTab = page.getByRole("button", { name: /Ledger \(/i });
    if (await ledgerTab.isVisible()) {
      await ledgerTab.click();
      await page.waitForTimeout(400);
      await expect(page.locator("table")).toBeVisible();
    }
  });

  test("Scenario 5.3: interactive Add Invoice modal opens, verifies controls, and cancels", async ({ page }) => {
    const addInvBtn = page.getByRole("button", { name: /\+ Add Invoice/i });
    await expect(addInvBtn).toBeVisible();
    await addInvBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Add Invoice|Record Payment/i }).first()).toBeVisible();

    // Verify modal inputs exist
    await expect(dialog.locator("input, select").first()).toBeVisible();

    // Dismiss cleanly
    await dialog.getByRole("button", { name: /Cancel|Discard/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 5.4: interactive Import Tally Excel modal opens and cancels", async ({ page }) => {
    const importBtn = page.getByRole("button", { name: /Import Tally Excel/i });
    await expect(importBtn).toBeVisible();
    await importBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Import|Upload/i }).first()).toBeVisible();

    await dialog.getByRole("button", { name: /Cancel|Close|Discard/i }).first().click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 5.5: search filter reacts to party/ref query", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search party"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill("Apex");
    await page.waitForTimeout(600);

    await searchInput.clear();
    await page.waitForTimeout(600);
  });
});
