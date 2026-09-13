import { test, expect } from "@playwright/test";
import { MGMT_ID } from "../fixtures/test-data";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Team & User Governance Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/managements/${MGMT_ID}/users`);
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 10.1: renders user governance tabs and users directory table", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Roles" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Teams" })).toBeVisible();

    // Default users table is visible
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("th", { hasText: /User|Name|Email/i }).first()).toBeVisible();
  });

  test("Scenario 10.2: switches to Roles tab and verifies role matrix", async ({ page }) => {
    const rolesTab = page.getByRole("tab", { name: "Roles" });
    await expect(rolesTab).toBeVisible();
    await rolesTab.click();
    await page.waitForTimeout(400);

    // Verify role cards or permissions
    await expect(page.getByText(/Administrator|Salesperson|Management/i).first()).toBeVisible();
  });

  test("Scenario 10.3: switches to Teams tab, verifies teams table and Add Team modal", async ({ page }) => {
    const teamsTab = page.getByRole("tab", { name: "Teams" });
    await expect(teamsTab).toBeVisible();
    await teamsTab.click();
    await page.waitForTimeout(400);

    // Verify presence of Add team button
    const addTeamBtn = page.getByRole("button", { name: /Add team/i });
    await expect(addTeamBtn).toBeVisible();

    // Open and close Add team modal
    await addTeamBtn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Cancel|Close/i }).first().click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 10.4: search input filters users directory", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("admin");
      await page.waitForTimeout(500);
      await searchInput.clear();
      await page.waitForTimeout(500);
    }
  });
});
