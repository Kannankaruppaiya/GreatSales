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

  /*
   * Scenarios 1.3 – 1.5 opened the New Sales Lead, Add Customer and Create
   * Order modals from the dashboard's quick-action bar. That bar was removed:
   * all three modals are opened from the page that owns the record — Leads,
   * Customers, Sales Orders — and those pages' own specs cover them, so this
   * is coverage moved rather than coverage lost.
   */
});
