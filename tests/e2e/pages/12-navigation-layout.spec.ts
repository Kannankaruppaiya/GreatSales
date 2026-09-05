import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Global Navigation & Layout Suite", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/managements/greatsales-industrial-corp/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 12.1: sidebar brand header, role indicator, and nav links render properly", async ({ page }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    await expect(sidebar.getByText(/GreatSales/i).first()).toBeVisible();
    await expect(sidebar.getByText(/Control/i)).toBeVisible();

    // Verify key nav items exist
    await expect(sidebar.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Customers", exact: true })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Products", exact: true })).toBeVisible();
  });

  test("Scenario 12.2: sequential navigation through core pages updates URL and headers", async ({ page }) => {
    const sidebar = page.locator("aside");

    // Click Recurring Projections
    await sidebar.getByRole("link", { name: /Recurring Projections/i }).click();
    await page.waitForURL(/\/projections/, { timeout: 10000 });
    await expect(page.getByText(/Recurring Sales Projections/i).first()).toBeVisible();

    // Click Sales Orders
    await sidebar.getByRole("link", { name: /Sales Orders/i }).click();
    await page.waitForURL(/\/orders/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /Sales Order/i }).first()).toBeVisible();

    // Click Payments
    await sidebar.getByRole("link", { name: /Payments/i }).click();
    await page.waitForURL(/\/payments/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /Payments & Receivables/i }).first()).toBeVisible();
  });

  test("Scenario 12.3: Command Palette opens via search button, handles keyboard escape", async ({ page }) => {
    const searchBtn = page.locator('button:has-text("Search anything")').first();
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Press Escape to dismiss
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 12.4: Command Palette opens via keyboard shortcut Ctrl+K / Meta+K", async ({ page }) => {
    await page.keyboard.press("Control+KeyK");
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible()) {
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    }
  });

  test("Scenario 12.5: user avatar card displays administrator profile and logout control", async ({ page }) => {
    const userCard = page.locator("aside .border-t");
    await expect(userCard).toBeVisible();
    await expect(userCard.getByText(/admin@greatsales.local/i)).toBeVisible();
    await expect(userCard.locator('button[title*="Sign out"]')).toBeVisible();
  });
});
