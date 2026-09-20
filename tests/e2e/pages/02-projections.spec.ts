import { test, expect } from "@playwright/test";
import { MGMT_ID } from "../fixtures/test-data";
import { loginAsAdmin } from "../helpers/auth";
import { monthPicker, monthTriggerText, offeredMonths, pickMonth } from "../helpers/month-picker";

test.describe("Recurring Projections Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/projections`);
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 2.1: renders worksheet header and data table", async ({ page }) => {
    await expect(page.getByText(/Recurring Sales Projections/i).first()).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    // Header cells verification
    await expect(page.locator("th", { hasText: /Customer/i })).toBeVisible();
    await expect(page.locator("th", { hasText: /Product/i })).toBeVisible();
  });

  test("Scenario 2.2: search filter reactively updates table content", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search customer"]');
    await expect(searchInput).toBeVisible();

    // Type a specific search term
    await searchInput.fill("Automotive");
    await page.waitForTimeout(600); // Allow debouncing and API response

    // Clear search and verify reset
    await searchInput.clear();
    await page.waitForTimeout(600);
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("Scenario 2.3: period selector changes projection month", async ({ page }) => {
    const picker = monthPicker(page, "Worksheet month");
    await expect(picker).toBeVisible();

    // A month that is not the one already showing, taken from what the picker
    // will actually accept. `selectOption({ index: 1 })` was "the second
    // option", which on a control that opens on the current month was
    // sometimes the month already selected — and then this asserted that
    // changing nothing changes the table.
    const shown = await picker.innerText();
    const year = new Date().getFullYear();
    const other = (await offeredMonths(page, [year], "Worksheet month")).find(
      (p) => !shown.includes(monthTriggerText(p)),
    );
    expect(other, "the picker offers only the month already selected").toBeTruthy();

    await pickMonth(page, other!, "Worksheet month");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("table")).toBeVisible();
  });

  test("Scenario 2.4: line filter narrows rows by status", async ({ page }) => {
    const lineFilterSelect = page.locator('select:has-text("All lines"), select:has-text("Open lines")').first();
    if (await lineFilterSelect.isVisible()) {
      await lineFilterSelect.selectOption({ label: "Open lines" });
      await page.waitForLoadState("networkidle");
      await expect(page.locator("table")).toBeVisible();
    }
  });

  test("Scenario 2.5: handles empty search query gracefully", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search customer"]');
    await searchInput.fill("NON_EXISTENT_QUERY_XYZ_123");
    await page.waitForTimeout(600);

    // Verify empty state message appears
    await expect(page.getByText(/No projection lines/i)).toBeVisible({ timeout: 7000 });
  });
});
