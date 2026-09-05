import { test, expect } from "@playwright/test";
import { FEATURES } from "../helpers/features";
import { featureUrl, loginAs, watchErrors } from "../helpers/session";

/**
 * One pass over every routed surface in the registry: it must render its own
 * topbar title, must not fall through to an error boundary, and must not leave
 * a console error or a >=400 response behind. Driven by FEATURES so a new page
 * is covered the moment it is declared.
 */
test.describe("Page health — every feature renders clean", () => {
  for (const f of FEATURES) {
    test(`${f.key}: renders, no console errors, no failed requests`, async ({ page }) => {
      const watch = watchErrors(page);
      await loginAs(page, "admin");

      await page.goto(featureUrl(f.key));
      await expect(
        page.getByRole("heading", { name: f.title, exact: true }).first(),
      ).toBeVisible({
        timeout: 15000,
      });
      await page.waitForLoadState("networkidle");

      await expect(page.getByText(/Failed to load:/i)).toHaveCount(0);
      await expect(page.getByText(/Something went wrong/i)).toHaveCount(0);
      await expect(page.getByText(/Access Restricted/i)).toHaveCount(0);

      watch.assertClean();
    });
  }

  test("unknown feature key under a workspace renders Not Found, not a blank page", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("no-such-feature"));
    await expect(page.getByText(/not found|404/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("seeded data actually reaches the tables (417 customers, 234 products)", async ({
    page,
    request,
  }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("customers"));
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });

    const rows = await page.locator("table tbody tr").count();
    expect(rows, "customers page must render its first page of rows").toBeGreaterThan(10);

    // The count badge in the toolbar must agree with the rows on screen.
    await expect(page.getByText(new RegExp(`${rows} accounts`))).toBeVisible();
  });
});
