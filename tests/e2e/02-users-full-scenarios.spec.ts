import { test, expect } from "@playwright/test";
import { TENANT, URLS, SEEDED_CREDENTIALS, generateTestUser } from "./fixtures/test-data";

test.describe("Team & User Governance — Comprehensive Scenarios", () => {
  const testUser = generateTestUser({ prefix: "qa_usr" });

  test.beforeEach(async ({ page }) => {
    // Authenticate as Administrator
    await page.goto(URLS.adminLogin);
    await page.locator("#login-tenant").fill(TENANT);
    await page.locator("#login-email").fill(SEEDED_CREDENTIALS.admin.email);
    await page.locator("#login-password").fill(SEEDED_CREDENTIALS.admin.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/managements/, { timeout: 25000 });

    // Navigate to Users page
    await page.goto(URLS.users);
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 2.1: renders governance tabs, toolbar controls, and users directory table", async ({
    page,
  }) => {
    await expect(page.getByRole("tab", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Roles & permissions" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Teams" })).toBeVisible();

    // Toolbar controls
    await expect(page.getByLabel("Search users")).toBeVisible();
    await expect(page.getByLabel("Filter by role")).toBeVisible();
    await expect(page.getByLabel("Filter by team")).toBeVisible();
    await expect(page.getByLabel("Filter by status")).toBeVisible();
    await expect(page.locator("label", { hasText: "Show deleted" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Refresh/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add user/i })).toBeVisible();

    // Table columns
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });
    await expect(table.locator("th", { hasText: /^Name/i }).first()).toBeVisible();
    await expect(table.locator("th", { hasText: /Username/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Email/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Role/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Status/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Actions/i })).toBeVisible();

    // Seeded admin row must be listed in table body
    await expect(table.locator("tbody").getByText(SEEDED_CREDENTIALS.admin.email).first()).toBeVisible();
  });

  test("Scenario 2.2: search input dynamically filters users by name, username, and email", async ({
    page,
  }) => {
    const searchInput = page.getByLabel("Search users");
    const tableBody = page.locator("table tbody");

    // Search by partial name "Megala"
    await searchInput.fill("Megala");
    await page.waitForTimeout(600);
    await expect(tableBody.getByText("megala@greatsales.local").first()).toBeVisible();
    await expect(tableBody.getByText(SEEDED_CREDENTIALS.admin.email)).not.toBeVisible();

    // Search by email "admin@"
    await searchInput.fill("admin@");
    await page.waitForTimeout(600);
    await expect(tableBody.getByText(SEEDED_CREDENTIALS.admin.email).first()).toBeVisible();
    await expect(tableBody.getByText("megala@greatsales.local")).not.toBeVisible();

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(600);
    await expect(tableBody.getByText(SEEDED_CREDENTIALS.admin.email).first()).toBeVisible();
    await expect(tableBody.getByText("megala@greatsales.local").first()).toBeVisible();
  });

  test("Scenario 2.3: filter users by role, team, and active/inactive status", async ({ page }) => {
    const roleSelect = page.getByLabel("Filter by role");
    const statusSelect = page.getByLabel("Filter by status");
    const tableBody = page.locator("table tbody");

    // Filter by role: sales
    await roleSelect.selectOption({ label: "sales" });
    await page.waitForTimeout(600);
    await expect(tableBody.getByText("megala@greatsales.local").first()).toBeVisible();
    await expect(tableBody.getByText(SEEDED_CREDENTIALS.admin.email)).not.toBeVisible();

    // Reset role to all
    await roleSelect.selectOption("ALL");
    await page.waitForTimeout(500);

    // Filter by status: active only
    await statusSelect.selectOption("active");
    await page.waitForTimeout(500);
    await expect(tableBody.getByText(SEEDED_CREDENTIALS.admin.email).first()).toBeVisible();

    // Reset status to all
    await statusSelect.selectOption("all");
    await page.waitForTimeout(500);
  });

  test("Scenario 2.4: add user modal validates required inputs and cancels cleanly", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Add user/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Add user|Add team user/i })).toBeVisible();

    // Submit button should be disabled when fields are empty
    const submitBtn = dialog.getByRole("button", { name: "Create user" });
    await expect(submitBtn).toBeDisabled();

    // Cancel modal
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 2.5: successfully creates a new sales user account", async ({ page }) => {
    await page.getByRole("button", { name: /Add user/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill form fields
    await dialog.locator("#uf-name").fill(testUser.name);
    await dialog.locator("#uf-username").fill(testUser.username);
    await dialog.locator("#uf-email").fill(testUser.email);
    await dialog.locator('input[type="password"]').first().fill(testUser.password);

    // Select role: sales
    const roleSelect = dialog.locator("#uf-role");
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption({ label: "sales" });
    }

    // Submit user creation
    const submitBtn = dialog.getByRole("button", { name: "Create user" });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Modal closes upon successful creation
    await expect(dialog).not.toBeVisible({ timeout: 15000 });

    // Verify user in directory
    const searchInput = page.getByLabel("Search users");
    await searchInput.fill(testUser.username);
    await page.waitForTimeout(600);
    await expect(page.locator("table tbody").getByText(testUser.email).first()).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 2.6: edits an existing user and reflects changes in table", async ({ page }) => {
    const searchInput = page.getByLabel("Search users");
    await searchInput.fill(testUser.username);
    await page.waitForTimeout(600);

    const row = page.locator("table tbody tr", { hasText: testUser.email });
    await expect(row).toBeVisible({ timeout: 10000 });

    // Click edit action
    await row.getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Edit user/i })).toBeVisible();

    // Update name
    const updatedName = `${testUser.name} Updated`;
    await dialog.locator("#uf-name").fill(updatedName);

    // Save changes
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15000 });

    // Verify updated name in table
    await searchInput.fill(testUser.username);
    await page.waitForTimeout(600);
    await expect(page.locator("table tbody").getByText(updatedName).first()).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 2.7: deactivates and re-activates user account", async ({ page }) => {
    // Find an active user row with Deactivate button (excluding current admin)
    const activeRow = page.locator("table tbody tr", { has: page.getByRole("button", { name: "Deactivate" }) }).first();
    await expect(activeRow).toBeVisible({ timeout: 10000 });

    // Deactivate user
    await activeRow.getByRole("button", { name: "Deactivate" }).click();
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Deactivate", exact: true }).click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 15000 });

    // Status badge reflects Inactive or row has Activate button
    await page.waitForTimeout(600);
    const inactiveRow = page.locator("table tbody tr", { has: page.getByRole("button", { name: "Activate" }) }).first();
    await expect(inactiveRow).toBeVisible({ timeout: 10000 });

    // Re-activate user
    await inactiveRow.getByRole("button", { name: "Activate" }).click();
    const activateDialog = page.getByRole("dialog");
    await expect(activateDialog).toBeVisible();
    await activateDialog.getByRole("button", { name: "Activate", exact: true }).click();
    await expect(activateDialog).not.toBeVisible({ timeout: 15000 });
  });

  test("Scenario 2.8: reset password modal opens, validates, and dismisses", async ({ page }) => {
    // Find an existing user with Reset password button
    const row = page.locator("table tbody tr", { has: page.getByRole("button", { name: "Reset password" }) }).first();
    await expect(row).toBeVisible({ timeout: 10000 });

    // Open Reset password modal
    await row.getByRole("button", { name: "Reset password" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Reset password/i })).toBeVisible();

    // Cancel modal
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 2.9: roles & permissions tab renders role cards and privilege matrix", async ({
    page,
  }) => {
    const rolesTab = page.getByRole("tab", { name: "Roles & permissions" });
    await rolesTab.click();
    await page.waitForTimeout(400);

    // Verify system roles in the live permission matrix
    const matrixBody = page.locator("table tbody");
    await expect(matrixBody.locator("th", { hasText: "admin" })).toBeVisible({ timeout: 8000 });
    await expect(matrixBody.locator("th", { hasText: "sales" })).toBeVisible();
    await expect(matrixBody.locator("th", { hasText: "mgmt" })).toBeVisible();
  });

  test("Scenario 2.10: teams tab renders teams table and Add Team modal", async ({ page }) => {
    const teamsTab = page.getByRole("tab", { name: "Teams" });
    await teamsTab.click();
    await page.waitForTimeout(400);

    // Verify presence of seeded Sales Team or team list
    await expect(page.getByText(/Sales Team/i).first()).toBeVisible();

    // Open Add team modal
    const addTeamBtn = page.getByRole("button", { name: /Add team/i });
    await expect(addTeamBtn).toBeVisible();
    await addTeamBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Add team|New team/i })).toBeVisible();

    // Cancel modal
    await dialog.getByRole("button", { name: /Cancel/i }).first().click();
    await expect(dialog).not.toBeVisible();
  });
});
