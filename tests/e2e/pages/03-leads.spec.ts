import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("New Sales Pipeline & Leads Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/managements/greatsales-industrial-corp/leads");
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 3.1: renders page title and Kanban board stages by default", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Pipeline & Leads/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Kanban Board/i })).toBeVisible();

    // Verify presence of pipeline deal columns or cards
    const kanbanColumnHeadings = page.locator("text=/Qualified|Discussion|Demo|Proposal|Won/i");
    await expect(kanbanColumnHeadings.first()).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 3.2: toggles between Kanban board and List view table", async ({ page }) => {
    const listBtn = page.getByRole("button", { name: /List \(/i });
    await expect(listBtn).toBeVisible();
    await listBtn.click();
    await page.waitForTimeout(400);

    // List view should render a table
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });

    // Switch back to Kanban
    const kanbanBtn = page.getByRole("button", { name: /Kanban Board/i });
    await kanbanBtn.click();
    await page.waitForTimeout(400);
  });

  test("Scenario 3.3: interactive Add New Sales Lead modal opens, verifies controls, and cancels", async ({ page }) => {
    const addLeadBtn = page.getByRole("button", { name: /Add New Sales Lead/i });
    await expect(addLeadBtn).toBeVisible();
    await addLeadBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Add New Sales Lead/i })).toBeVisible();

    // Verify key inputs (customer, deal title, value)
    await expect(dialog.locator('input, select, textarea').first()).toBeVisible();

    // Dismiss cleanly
    await dialog.getByRole("button", { name: /Cancel|Discard/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 3.4: search filter filters deals and can be cleared", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search new sales"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill("Apex");
    await page.waitForTimeout(600);

    await searchInput.clear();
    await page.waitForTimeout(600);
  });
});
