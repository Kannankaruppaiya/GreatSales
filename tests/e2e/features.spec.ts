import { test, expect } from "@playwright/test";
import { MGMT_ID } from "./fixtures/test-data";
import { loginAsAdmin } from "./helpers/auth";

test.describe("GreatSales All Features Suite", () => {
  test("1. Dashboard Feature: renders executive overview and KPI metrics", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/dashboard`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Executive Overview/i })).toBeVisible();

    // Verify KPI cards
    await expect(page.getByText(/Recurring committed/i)).toBeVisible();
    await expect(page.getByText(/Recurring achieved/i).first()).toBeVisible();
    await expect(page.getByText(/New sales committed/i)).toBeVisible();
    await expect(page.getByText(/Total committed/i)).toBeVisible();

    // The dashboard's quick-action bar is gone; the lead and customer modals
    // are opened from the Leads and Customers pages, which tests 3 and 7 below
    // already do.
  });

  test("2. Recurring Projections Feature: renders table and search filter", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/projections`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Recurring/i })).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Automotive");
    await page.waitForTimeout(400);
    await searchInput.clear();
  });

  test("3. Leads & Pipeline Feature: toggles views and tests Add Lead modal", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/leads`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Pipeline & Leads/i })).toBeVisible();

    // Toggle view modes
    const listViewBtn = page.locator('button:has-text("List View"), button[aria-label="List View"]');
    if (await listViewBtn.isVisible()) {
      await listViewBtn.click();
    }

    // Open and close Add Lead modal
    const addBtn = page.getByRole("button", { name: /\+ Add New Sales Lead/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: /Cancel/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test("4. Sales Orders Feature: displays orders table and Create Order modal", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/orders`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Sales Order/i })).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    const createBtn = page.getByRole("button", { name: /\+ Create Sales Order/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: /Cancel/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test("5. Payments & Receivables Feature: renders aging and Record Payment modal", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/payments`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Payments & Receivables/i })).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    const recordBtn = page.getByRole("button", { name: /\+ (Record Payment|Add Invoice)/i });
    if (await recordBtn.isVisible()) {
      await recordBtn.click();
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      await modal.getByRole("button", { name: /Cancel/i }).click();
      await expect(modal).not.toBeVisible();
    }
  });

  test("6. Follow-ups Feature: displays timeline and Add Follow-up modal", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/followups`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Actionable Timeline/i)).toBeVisible();

    const addBtn = page.getByRole("button", { name: /\+ Add follow-up/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      await modal.getByRole("button", { name: /Cancel/i }).click();
      await expect(modal).not.toBeVisible();
    }
  });

  test("7. Customers Feature: renders directory table and Add Customer modal", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/customers`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Customer/i }).first()).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    const addBtn = page.getByRole("button", { name: /\+ Add New Customer/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: /Cancel/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test("8. Products Feature: renders catalog and Add Product modal", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/products`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Product/i }).first()).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10000 });

    const addBtn = page.getByRole("button", { name: /\+ (Add Product|Add Brand)/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      await modal.getByRole("button", { name: /Cancel/i }).click();
      await expect(modal).not.toBeVisible();
    }
  });

  test("9. Customer & Product Mapping Feature: renders grid and Map Product modal", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/mappings`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Mapping/i }).first()).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    const mapBtn = page.getByRole("button", { name: /Map a product/i });
    if (await mapBtn.isVisible()) {
      await mapBtn.click();
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      await modal.getByRole("button", { name: /Cancel/i }).click();
      await expect(modal).not.toBeVisible();
    }
  });

  test("10. Team & User Governance Feature: renders users and switches to Teams tab", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/users`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("tab", { name: "Users" })).toBeVisible();
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    const teamsTab = page.getByRole("tab", { name: "Teams" });
    await expect(teamsTab).toBeVisible();
    await teamsTab.click();
    await expect(page.getByRole("button", { name: /Add team/i })).toBeVisible();
  });

  test("11. Data Administration Feature: renders metrics and overview cards", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/data`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Data/i }).first()).toBeVisible();
    await expect(page.getByText(/Tenant Database Context/i)).toBeVisible();
    await expect(page.getByText(/Live PostgreSQL Tenant Records/i)).toBeVisible();
  });

  test("12. Global Navigation & Layout: tests sidebar links and command palette", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/dashboard`);

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    // Click Customers link
    await sidebar.getByRole("link", { name: "Customers", exact: true }).click();
    await page.waitForURL(/\/customers/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /Customer/i }).first()).toBeVisible();

    // Open Command Palette
    await page.locator('button:has-text("Search anything"), input[placeholder*="Search anything"]').first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
  });
});
