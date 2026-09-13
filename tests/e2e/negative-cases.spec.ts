import { test, expect } from "@playwright/test";
import { MGMT_ID } from "./fixtures/test-data";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Frontend Negative & Error Resilience Edge Cases", () => {
  test("enforces form validation: keeps submit disabled when required fields are empty", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.goto(`/managements/${MGMT_ID}/customers`);
    await expect(page.locator("h1")).toContainText(/Customer/i);

    // Open "Add New Customer" modal
    const addBtn = page.getByRole("button", { name: /\+ Add New Customer/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Submit button must be disabled when 'name' is empty
    const submitBtn = dialog.getByRole("button", { name: /Create Customer/i });
    await expect(submitBtn).toBeDisabled();

    // Type a valid customer name -> Submit button must become enabled
    const nameInput = dialog.getByPlaceholder(/Anand Automotive/i);
    await nameInput.fill("Valid Test Corp");
    await expect(submitBtn).toBeEnabled();

    // Clear the input -> Submit button must become disabled again
    await nameInput.fill("");
    await expect(submitBtn).toBeDisabled();

    // Close the modal cleanly
    const cancelBtn = dialog.getByRole("button", { name: /Cancel/i });
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test("gracefully handles backend 500 error via QueryBoundary without crashing UI", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Intercept /api/v1/customers with simulated 500 Internal Server Error
    await page.route("**/api/v1/customers*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 500,
          error: "InternalServerError",
          message: "Simulated database connection failure",
        }),
      });
    });

    await page.goto(`/managements/${MGMT_ID}/customers`);

    // Header and layout must remain intact and visible
    await expect(page.locator("h1")).toContainText(/Customer Master Directory/i);
    await expect(page.locator("aside")).toBeVisible();

    // QueryBoundary must render the error message
    const errorCard = page.getByText(/Failed to load:/i);
    await expect(errorCard).toBeVisible({ timeout: 10000 });
  });

  test("unauthenticated access to protected management routes redirects to login", async ({
    browser,
  }) => {
    // Isolated fresh context with zero cookies/localStorage
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/managements/${MGMT_ID}/customers`);

    // Must be redirected to login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/login/);

    await context.close();
  });
});
