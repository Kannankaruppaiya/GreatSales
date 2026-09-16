import { test, expect } from "@playwright/test";
import { MGMT_ID } from "../fixtures/test-data";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Dashboard Page (Executive Overview)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/dashboard`);
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 1.1: renders the page heading and its salesperson chart", async ({ page }) => {
    // The dashboard's own banner — an eyebrow, a headline and a line of copy,
    // all telling somebody standing on the page what page they were on — was
    // removed. The shell names the page, and the chart is the first thing the
    // dashboard itself draws.
    await expect(page.getByRole("heading", { name: /Executive Overview/i })).toBeVisible();
    await expect(page.getByText(/Committed vs achieved by salesperson/i)).toBeVisible();
  });

  test("Scenario 1.2: validates all 4 core KPI summary cards with metrics", async ({ page }) => {
    await expect(page.getByText(/Recurring committed/i)).toBeVisible();
    await expect(page.getByText(/Recurring achieved/i).first()).toBeVisible();
    await expect(page.getByText(/New sales committed/i)).toBeVisible();
    await expect(page.getByText(/Total committed/i)).toBeVisible();

    // Verify presence of tabular metric numbers (e.g. ₹ or lakhs indicator)
    const kpiCards = page.locator(".tabular-nums");
    await expect(kpiCards.first()).toBeVisible();
    const count = await kpiCards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("Scenario 1.3: interactive New Sales Lead modal opens, checks controls, and cancels", async ({ page }) => {
    const addLeadBtn = page.getByRole("button", { name: /New Sales Lead/i });
    await expect(addLeadBtn).toBeVisible();
    await addLeadBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Add New Sales Lead|New Sales Deal/i }).first()).toBeVisible();

    // Verify fields inside modal
    await expect(dialog.locator("input, select, textarea").first()).toBeVisible();

    // Dismiss modal cleanly
    const cancelBtn = dialog.getByRole("button", { name: /Cancel|Discard/i });
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 1.4: interactive Add Customer modal opens, checks controls, and cancels", async ({ page }) => {
    const addCustBtn = page.getByRole("button", { name: /Add Customer/i });
    await expect(addCustBtn).toBeVisible();
    await addCustBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Customer/i }).first()).toBeVisible();

    // Dismiss modal
    const cancelBtn = dialog.getByRole("button", { name: /Cancel|Discard/i });
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 1.5: interactive Create Order modal opens and cancels cleanly", async ({ page }) => {
    const createOrderBtn = page.getByRole("button", { name: /Create Order/i });
    await expect(createOrderBtn).toBeVisible();
    await createOrderBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Order/i }).first()).toBeVisible();

    const cancelBtn = dialog.getByRole("button", { name: /Cancel|Discard/i });
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });
});
