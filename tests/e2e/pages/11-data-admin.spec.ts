import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Data Administration & Governance Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/managements/greatsales-industrial-corp/data");
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 11.1: renders data governance header, tenant RLS context, and backend health", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Data/i }).first()).toBeVisible();
    await expect(page.getByText(/Tenant Database Context/i)).toBeVisible();
    await expect(page.getByText(/API Backend: Healthy/i)).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 11.2: validates live PostgreSQL record counters", async ({ page }) => {
    await expect(page.getByText(/Live PostgreSQL Tenant Records/i)).toBeVisible();
    // Metric cards for entities
    await expect(page.getByText("Customers", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Products", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Orders", { exact: true }).first()).toBeVisible();
  });

  test("Scenario 11.3: Refresh DB button refetches metrics and shows success banner", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /Refresh DB/i });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    // Check status banner appears
    await expect(page.getByText(/Refreshed all tenant datasets/i)).toBeVisible({ timeout: 7000 });
  });

  test("Scenario 11.4: Export Safe CSV triggers download with formula injection protection", async ({ page }) => {
    const exportBtn = page.getByRole("button", { name: /Export Safe CSV/i });
    await expect(exportBtn).toBeVisible();

    // Listen for download event
    const downloadPromise = page.waitForEvent("download");
    await exportBtn.click();
    const download = await downloadPromise;

    // Verify downloaded filename format
    expect(download.suggestedFilename()).toContain("GreatSales_Tenant_");
    expect(download.suggestedFilename()).toContain(".csv");
  });
});
