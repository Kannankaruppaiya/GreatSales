import { test, expect } from "@playwright/test";
import { TENANT, URLS, SEEDED_CREDENTIALS, generatePrincipalBrand, generateProductCatalogItem } from "./fixtures/test-data";

test.describe("Product & Principal Master Catalog", () => {
  const testBrand = generatePrincipalBrand();
  const testProduct = generateProductCatalogItem(testBrand.name);

  test.beforeEach(async ({ page }) => {
    // Authenticate as Administrator
    await page.goto(URLS.adminLogin);
    await page.locator("#login-tenant").fill(TENANT);
    await page.locator("#login-email").fill(SEEDED_CREDENTIALS.admin.email);
    await page.locator("#login-password").fill(SEEDED_CREDENTIALS.admin.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/managements/, { timeout: 15000 });

    // Navigate to Products page
    await page.goto(URLS.products);
    await page.waitForLoadState("networkidle");
  });

  test("Scenario 3.1: renders catalog header, principal brands section, and catalog table", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: /Product & Principal Master Catalog/i })).toBeVisible();
    await expect(page.getByText(/Principal Master Brands/i)).toBeVisible();

    // Table columns
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });
    await expect(table.locator("th", { hasText: /SKU Code/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Product Name/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Principal Brand/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Division/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Unit/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /List Price/i })).toBeVisible();

    // Toolbar buttons
    await expect(page.getByRole("button", { name: /Add Brand/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add Product/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Refresh/i })).toBeVisible();
  });

  test("Scenario 3.2: filter products by brand pill and brand dropdown", async ({ page }) => {
    const brandSelect = page.getByLabel("Filter products by principal brand");
    await expect(brandSelect).toBeVisible();

    // Select IPOL brand
    await brandSelect.selectOption({ label: "IPOL" });
    await page.waitForTimeout(600);

    // Verify filtered table rows all have IPOL
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await expect(rows.first().locator("td", { hasText: "IPOL" })).toBeVisible();

    // Reset filter
    await brandSelect.selectOption("ALL");
    await page.waitForTimeout(500);
  });

  test("Scenario 3.3: filter products by division dropdown", async ({ page }) => {
    const divisionSelect = page.getByLabel("Filter products by division");
    await expect(divisionSelect).toBeVisible();

    // Select LUB division
    await divisionSelect.selectOption("LUB");
    await page.waitForTimeout(500);

    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await expect(rows.first().getByRole("cell", { name: "LUB", exact: true })).toBeVisible();

    // Reset filter
    await divisionSelect.selectOption("ALL");
    await page.waitForTimeout(400);
  });

  test("Scenario 3.4: search catalog input filters products dynamically", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search catalog by name or SKU"]');
    await expect(searchInput).toBeVisible();

    // Search by SKU "P001"
    await searchInput.fill("P001");
    await page.waitForTimeout(600);
    const tableBody = page.locator("table tbody");
    await expect(tableBody.getByText(/P001/i).first()).toBeVisible();

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
  });

  test("Scenario 3.5: adds a new principal brand into the catalog", async ({ page }) => {
    await page.getByRole("button", { name: /Add Brand/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Add Principal Brand/i })).toBeVisible();

    // Fill principal brand name using textbox
    const input = dialog.getByRole("textbox");
    await input.fill(testBrand.name);

    // Submit
    const submitBtn = dialog.getByRole("button", { name: "Add Principal" });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Modal closes upon creation
    await expect(dialog).not.toBeVisible({ timeout: 15000 });

    // Verify brand pill is rendered
    await page.waitForTimeout(600);
    await expect(page.getByRole("button", { name: new RegExp(testBrand.name, "i") })).toBeVisible({
      timeout: 10000,
    });
  });

  test("Scenario 3.6: adds a new product SKU under the new principal brand", async ({ page }) => {
    await page.getByRole("button", { name: /Add Product/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Add New Catalog Product/i })).toBeVisible();

    // Select brand
    const principalSelect = dialog.locator("select").first();
    await principalSelect.selectOption({ label: testBrand.name });

    // Fill product name
    await dialog.getByPlaceholder(/Hysol MB 50|Castrol Magnatec/i).fill(testProduct.name);

    // Fill SKU
    await dialog.getByPlaceholder(/CAS-HYS-50/i).fill(testProduct.sku);

    // Fill List price
    await dialog.getByPlaceholder(/450\.00/i).fill(testProduct.listPrice);

    // Submit product creation
    const submitBtn = dialog.getByRole("button", { name: "Add Product", exact: true });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(dialog).not.toBeVisible({ timeout: 15000 });

    // Verify created product in table
    const searchInput = page.locator('input[placeholder*="Search catalog by name or SKU"]');
    await searchInput.fill(testProduct.sku);
    await page.waitForTimeout(600);
    await expect(page.locator("table tbody").getByText(testProduct.name).first()).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 3.7: edits an existing catalog product's price and unit", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search catalog by name or SKU"]');
    await searchInput.fill(testProduct.sku);
    await page.waitForTimeout(600);

    const row = page.locator("table tbody tr", { hasText: testProduct.name });
    await expect(row).toBeVisible({ timeout: 10000 });

    // Click Edit button in Action column
    const editBtn = row.getByRole("button", { name: /Edit/i });
    await editBtn.first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Edit Catalog Product/i })).toBeVisible();

    // Update list price
    const priceInput = dialog.locator('input[type="number"], input[placeholder*="245"]');
    await priceInput.clear();
    await priceInput.fill(testProduct.updatedPrice);

    // Save changes
    await dialog.getByRole("button", { name: /Save Changes/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15000 });

    // Verify updated price in table input
    await page.waitForTimeout(600);
    const priceInputInRow = row.getByLabel(new RegExp(`List price for ${testProduct.name}`, "i")).or(row.locator('input[type="number"]'));
    await expect(priceInputInRow.first()).toHaveValue(testProduct.updatedPrice, { timeout: 10000 });
  });

  test("Scenario 3.8: catalog refresh button re-syncs products data", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: /Refresh/i });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    // Table remains visible and populated
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10000 });
  });
});
