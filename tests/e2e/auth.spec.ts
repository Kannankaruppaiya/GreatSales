import { test, expect } from "@playwright/test";
import { MGMT_ID } from "./fixtures/test-data";

test.describe("Authentication & Route Protection", () => {
  test("unauthenticated visitor is redirected from protected route to /login", async ({ page }) => {
    await page.goto(`/managements/${MGMT_ID}/dashboard`);
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator("#login-email")).toBeVisible();
  });

  test("renders portal selections properly (/admin/login, /sales/login, /management/login)", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator("h2")).toContainText(/Administrator Portal/i);

    await page.getByRole("link", { name: "Salesperson" }).click();
    await expect(page.locator("h2")).toContainText(/Salesperson Portal/i);

    await page.getByRole("link", { name: "Management" }).click();
    await expect(page.locator("h2")).toContainText(/Management Portal/i);
  });

  test("rejects invalid login credentials with an inline error alert", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator("#login-tenant").fill("tenant_promech");
    await page.locator("#login-email").fill("wronguser@greatsales.local");
    await page.locator("#login-password").fill("wrongpassword_9999");
    await page.locator('button[type="submit"]').click();

    const alert = page.locator("#login-error");
    await expect(alert).toBeVisible({ timeout: 7000 });
    await expect(alert).toHaveAttribute("role", "alert");
  });

  test("successful login and subsequent logout flow", async ({ page }) => {
    await page.goto("/management/login");
    await page.locator("#login-tenant").fill("tenant_promech");
    await page.locator("#login-email").fill("manager@greatsales.local");
    await page.locator("#login-password").fill("1234");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/managements/, { timeout: 15000 });
    await expect(page.locator("aside")).toBeVisible();

    // Click logout button using title="Sign out"
    const logoutBtn = page.locator('button[title="Sign out"]');
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator("#login-email")).toBeVisible();
  });
});
