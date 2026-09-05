import { test, expect } from "@playwright/test";
import { TENANT, URLS, SEEDED_CREDENTIALS } from "./fixtures/test-data";

test.describe("Admin Panel Authentication & Route Security", () => {
  test("Scenario 1.1: unauthenticated access to protected management routes redirects to login", async ({
    page,
  }) => {
    await page.goto(URLS.dashboard);
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page.locator("#login-email")).toBeVisible({ timeout: 10000 });

    // Also verify protected users directory route
    await page.goto(URLS.users);
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page.locator("#login-email")).toBeVisible();
  });

  test("Scenario 1.2: portal switcher allows navigation across dedicated portals", async ({
    page,
  }) => {
    await page.goto(URLS.adminLogin);
    await expect(page.locator("h2")).toContainText(/Administrator Portal/i);

    // Switch to Salesperson portal
    await page.getByRole("link", { name: "Salesperson" }).click();
    await page.waitForURL(/\/sales\/login/, { timeout: 10000 });
    await expect(page.locator("h2")).toContainText(/Salesperson Portal/i);

    // Switch to Management portal
    await page.getByRole("link", { name: "Management" }).click();
    await page.waitForURL(/\/management\/login/, { timeout: 10000 });
    await expect(page.locator("h2")).toContainText(/Management Portal/i);

    // Switch to Super Admin notice
    await page.getByRole("link", { name: "Super Admin" }).click();
    await page.waitForURL(/\/super-admin\/login/, { timeout: 10000 });
    await expect(page.getByText(/Platform Sign-In Coming Soon/i)).toBeVisible();

    // Link back to Administrator portal
    await page.getByRole("link", { name: /Go to Administrator Portal/i }).click();
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 });
    await expect(page.locator("h2")).toContainText(/Administrator Portal/i);
  });

  test("Scenario 1.3: rejects invalid credentials with descriptive error alert", async ({
    page,
  }) => {
    await page.goto(URLS.adminLogin);

    // Bad password
    await page.locator("#login-tenant").fill(TENANT);
    await page.locator("#login-email").fill(SEEDED_CREDENTIALS.admin.email);
    await page.locator("#login-password").fill("invalid_password_xyz");
    await page.locator('button[type="submit"]').click();

    const alert = page.locator("#login-error");
    await expect(alert).toBeVisible({ timeout: 8000 });
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toContainText(/email and password combination is not correct|invalid/i);

    // Invalid tenant
    await page.locator("#login-tenant").fill("non_existent_tenant_9999");
    await page.locator('button[type="submit"]').click();
    await expect(alert).toBeVisible({ timeout: 8000 });
  });

  test("Scenario 1.4: successful admin login establishes session and navigates to workspace", async ({
    page,
  }) => {
    await page.goto(URLS.adminLogin);
    await page.locator("#login-tenant").fill(TENANT);
    await page.locator("#login-email").fill(SEEDED_CREDENTIALS.admin.email);
    await page.locator("#login-password").fill(SEEDED_CREDENTIALS.admin.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/managements/, { timeout: 15000 });
    await expect(page.locator("aside")).toBeVisible({ timeout: 10000 });

    // Verify admin branding and bottom profile identity
    await expect(page.getByText(/Administrator Control/i).first()).toBeVisible();
    await expect(page.getByText(SEEDED_CREDENTIALS.admin.displayName).first()).toBeVisible();
    await expect(page.getByText(SEEDED_CREDENTIALS.admin.email).first()).toBeVisible();

    // Admin should see both Users and Products in the sidebar
    await expect(page.locator("aside").getByRole("link", { name: "Users" })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: "Products" })).toBeVisible();
  });

  test("Scenario 1.5: logout flow invalidates session and prevents protected route access", async ({
    page,
  }) => {
    // Perform login first
    await page.goto(URLS.adminLogin);
    await page.locator("#login-tenant").fill(TENANT);
    await page.locator("#login-email").fill(SEEDED_CREDENTIALS.admin.email);
    await page.locator("#login-password").fill(SEEDED_CREDENTIALS.admin.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/managements/, { timeout: 15000 });

    // Trigger logout
    const logoutBtn = page.locator('button[title="Sign out"]');
    await expect(logoutBtn).toBeVisible({ timeout: 8000 });
    await logoutBtn.click();

    // Verify redirection to login page
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator("#login-email")).toBeVisible();

    // Attempt to navigate back to dashboard
    await page.goto(URLS.dashboard);
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator("#login-email")).toBeVisible();
  });
});
