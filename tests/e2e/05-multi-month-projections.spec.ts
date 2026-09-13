import { test, expect } from "@playwright/test";
import { TENANT, URLS, SEEDED_CREDENTIALS } from "./fixtures/test-data";

test.describe("Multi-Month Projections & Analytics Verification", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Admin
    await page.goto(URLS.adminLogin);
    await page.locator("#login-tenant").fill(TENANT);
    await page.locator("#login-email").fill(SEEDED_CREDENTIALS.admin.email);
    await page.locator("#login-password").fill(SEEDED_CREDENTIALS.admin.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/managements/, { timeout: 15000 });
  });

  test("Scenario 5.1: Projections page displays populated data on current month (Sep 2026)", async ({
    page,
  }) => {
    await page.goto(URLS.projections);
    await page.waitForLoadState("networkidle");

    // Month filter defaults to or is set to Sep 2026
    const monthSelect = page.locator("select").first();
    await expect(monthSelect).toBeVisible();

    // Verify projection rows exist
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(10);

    // Verify summary values are populated (Committed > 0, Achieved > 0)
    const summaryText = await page.getByText(/Showing \d+ lines/i).textContent();
    expect(summaryText).toBeTruthy();
    expect(summaryText).not.toContain("Committed ₹0");
  });

  test("Scenario 5.2: Projections page seamlessly switches and renders data across multiple FY months", async ({
    page,
  }) => {
    await page.goto(URLS.projections);
    await page.waitForLoadState("networkidle");

    // The months the seed actually fills, counted back from today rather than
    // written down. This was a list of six literals spanning Apr 2026 to Mar
    // 2027, most of which never held a row — the spec was asserting that a
    // table renders in months the dataset has nothing in.
    const testMonths = Array.from({ length: 3 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (2 - i));
      return {
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      };
    });

    const monthSelect = page.locator("select").first();

    for (const m of testMonths) {
      await monthSelect.selectOption({ label: m.label });
      await page.waitForLoadState("networkidle");

      // Verify selected value in dropdown
      await expect(monthSelect).toHaveValue(m.value);

      // Verify table rows load for selected period
      const firstRow = page.locator("table tbody tr").first();
      await expect(firstRow).toBeVisible({ timeout: 10000 });
    }
  });

  test("Scenario 5.3: Dashboard overview reflects live KPIs and salesperson breakdown across multiple months", async ({
    page,
  }) => {
    await page.goto(URLS.dashboard);
    await page.waitForLoadState("networkidle");

    // Verify Sep 2026 dashboard has non-zero total committed
    await expect(page.getByText(/Total committed/i)).toBeVisible();
    const totalCommittedCard = page.locator('div:has-text("Total committed")').last();
    await expect(totalCommittedCard).not.toContainText("₹0");

    // Switch topbar month filter to Dec 2026
    const topbarMonth = page.getByRole("combobox", { name: /Filter by month/i }).or(page.locator("select").first());
    if (await topbarMonth.isVisible()) {
      await topbarMonth.selectOption({ label: "Dec 2026" });
      await page.waitForLoadState("networkidle");

      // Verify Dec 2026 dashboard renders updated figures
      await expect(page.getByText(/COMMERCIAL SALES PULSE/i)).toBeVisible();
    }

    // Switch topbar salesperson filter to Megala (or second salesperson)
    const spSelect = page.getByRole("combobox", { name: /Filter by salesperson/i });
    if (await spSelect.isVisible()) {
      const options = await spSelect.locator("option").allTextContents();
      const targetSp = options.find((o) => o.includes("Megala")) || options[1];
      if (targetSp) {
        await spSelect.selectOption({ label: targetSp });
        await page.waitForLoadState("networkidle");

        // Verify dashboard updates to show only selected salesperson in breakdown
        await expect(page.locator(".font-sans").first()).toBeVisible();
      }
    }
  });

  test("Scenario 5.4: Inline edit Achieved Qty on Sep 2026 persists via API", async ({
    page,
  }) => {
    await page.goto(URLS.projections);
    await page.waitForLoadState("networkidle");

    // Select Sep 2026
    const monthSelect = page.locator("select").first();
    await monthSelect.selectOption({ label: "Sep 2026" });
    await page.waitForLoadState("networkidle");

    // Locate first Achieved Quantity numeric input
    const numberCell = page.locator('table tbody tr input[type="number"]').first();
    await expect(numberCell).toBeVisible({ timeout: 10000 });

    const originalVal = await numberCell.inputValue();
    const newVal = String((Number(originalVal) || 0) + 10);

    const patchPromise = page.waitForResponse(
      (res) => res.url().includes("/api/v1/projections") && res.request().method() === "PATCH",
      { timeout: 10000 },
    );

    await numberCell.fill(newVal);
    await numberCell.press("Enter");

    const patchRes = await patchPromise;
    expect(patchRes.status()).toBe(200);

    // Verify cell holds the new value
    await expect(numberCell).toHaveValue(newVal);

    // Revert back
    await numberCell.fill(originalVal);
    await numberCell.press("Enter");
  });
});
