import { Page, expect } from "@playwright/test";

/**
 * Robust UI login as administrator that establishes full in-memory Zustand token
 * and httpOnly refresh cookie, navigating directly into the workspace.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.locator("#login-tenant").fill("tenant_promech");
  await page.locator("#login-email").fill("admin@greatsales.local");
  await page.locator("#login-password").fill("admin");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/managements/, { timeout: 15000 });
  await expect(page.locator("aside")).toBeVisible({ timeout: 10000 });
}
