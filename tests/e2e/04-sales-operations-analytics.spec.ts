import { test, expect } from "@playwright/test";
import { TENANT, URLS, SEEDED_CREDENTIALS, SEEDED_PERIOD } from "./fixtures/test-data";

test.describe("Sales Operations & Analytics Suite (All 8 Surfaces)", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Sales Representative (Megala)
    await page.goto(URLS.salesLogin);
    await page.locator("#login-tenant").fill(TENANT);
    await page.locator("#login-email").fill(SEEDED_CREDENTIALS.sales.email);
    await page.locator("#login-password").fill(SEEDED_CREDENTIALS.sales.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/managements/, { timeout: 15000 });
  });

  test("Scenario 4.0: sales authentication & RBAC boundary verification", async ({ page }) => {
    // Verify topbar salesperson control badge and bottom profile identity
    await expect(page.getByText(/Salesperson Control/i).first()).toBeVisible();
    await expect(page.getByText(SEEDED_CREDENTIALS.sales.displayName).first()).toBeVisible();
    await expect(page.getByText(SEEDED_CREDENTIALS.sales.email).first()).toBeVisible();

    // Verify all 8 Operations & Analytics links are present in the sidebar
    const aside = page.locator("aside");
    await expect(aside.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(aside.getByRole("link", { name: "Recurring Projections" })).toBeVisible();
    await expect(aside.getByRole("link", { name: "New Sales Customers" })).toBeVisible();
    await expect(aside.getByRole("link", { name: "Sales Orders" })).toBeVisible();
    await expect(aside.getByRole("link", { name: "Payments Follow-up" })).toBeVisible();
    await expect(aside.getByRole("link", { name: "Follow-ups" })).toBeVisible();
    await expect(aside.getByRole("link", { name: "My Customers" })).toBeVisible();
    await expect(aside.getByRole("link", { name: "My Customer Mapping" })).toBeVisible();

    // Enforce RBAC: Admin pages (Users & Products) must NOT be visible in the sidebar
    await expect(aside.getByRole("link", { name: /^Users$/ })).not.toBeVisible();
    await expect(aside.getByRole("link", { name: /^Products$/ })).not.toBeVisible();
  });

  test("Scenario 4.1: Dashboard page (KPI metrics, period selection, and quick modals)", async ({
    page,
  }) => {
    await page.goto(URLS.dashboard);
    await page.waitForLoadState("networkidle");

    // Verify Header and Commercial Sales Pulse
    await expect(page.getByRole("heading", { name: /Revenue Performance & Pipeline Tracker/i })).toBeVisible();

    // Verify Core KPI metric cards
    await expect(page.getByText(/Recurring committed/i)).toBeVisible();
    await expect(page.getByText(/Recurring achieved/i).first()).toBeVisible();
    await expect(page.getByText(/New sales committed/i)).toBeVisible();
    await expect(page.getByText(/Total committed/i)).toBeVisible();
    await expect(page.getByText(/Total achieved/i)).toBeVisible();
    await expect(page.getByText(/Follow-ups due/i)).toBeVisible();

    // Verify "My deals at Oral Confirmation" section
    await expect(page.getByText(/My deals at Oral Confirmation/i)).toBeVisible();

    // Quick Action 1: New Sales Lead modal opens and cancels
    const addLeadBtn = page.getByRole("button", { name: /New Sales Lead/i });
    await expect(addLeadBtn).toBeVisible();
    await addLeadBtn.click();
    let dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Cancel|Discard/i }).click();
    await expect(dialog).not.toBeVisible();

    // Quick Action 2: Add Customer modal opens and cancels
    const addCustBtn = page.getByRole("button", { name: /Add Customer/i });
    await expect(addCustBtn).toBeVisible();
    await addCustBtn.click();
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Cancel|Discard/i }).click();
    await expect(dialog).not.toBeVisible();

    // Quick Action 3: Create Order modal opens and cancels
    const createOrderBtn = page.getByRole("button", { name: /Create Order/i });
    await expect(createOrderBtn).toBeVisible();
    await createOrderBtn.click();
    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Cancel|Discard/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("Scenario 4.2: Recurring Projections worksheet (grid, period filter, and inline save)", async ({
    page,
  }) => {
    await page.goto(URLS.projections);
    await page.waitForLoadState("networkidle");

    // Select authoritative seeded period (June 2026)
    const monthSelect = page.getByLabel(/Filter by month|Month/i).or(page.locator("select").first());
    if (await monthSelect.isVisible()) {
      await monthSelect.selectOption(SEEDED_PERIOD);
      await page.waitForTimeout(800);
    }

    // Verify worksheet table headers
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 15000 });
    await expect(table.locator("th", { hasText: /Customer/i }).first()).toBeVisible();
    await expect(table.locator("th", { hasText: /Principal/i }).first()).toBeVisible();
    await expect(table.locator("th", { hasText: /Status/i }).first()).toBeVisible();

    // Inline edit of Achieved Quantity cell
    const numberCell = page.locator('table tbody tr input[type="number"]').first();
    if (await numberCell.isVisible()) {
      const originalValue = await numberCell.inputValue();
      const updatedValue = String((Number(originalValue) || 0) + 5);

      const patchPromise = page.waitForResponse(
        (res) => res.url().includes("/api/v1/projections") && res.request().method() === "PATCH",
        { timeout: 10000 },
      );

      await numberCell.fill(updatedValue);
      await numberCell.press("Enter");

      const patchRes = await patchPromise;
      expect(patchRes.status()).toBe(200);

      // Revert cell back to maintain seeded state
      await numberCell.fill(originalValue);
      await numberCell.press("Enter");
    }
  });

  test("Scenario 4.3: New Sales Customers / Leads (Kanban & List view toggle and details)", async ({
    page,
  }) => {
    await page.goto(URLS.leads);
    await page.waitForLoadState("networkidle");

    // Verify default view
    await expect(page.getByRole("button", { name: /Kanban Board/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /List \(/i })).toBeVisible();

    // Switch to List View
    await page.getByRole("button", { name: /List \(/i }).click();
    await page.waitForTimeout(500);
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10000 });

    // Switch back to Kanban Board
    await page.getByRole("button", { name: /Kanban Board/i }).click();
    await page.waitForTimeout(500);

    // Search input
    const searchInput = page.locator('input[placeholder*="Search new sales pipeline"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Precision");
    await page.waitForTimeout(500);
    await searchInput.clear();

    // Add Lead modal trigger and dismissal
    const addLeadBtn = page.getByRole("button", { name: /\+ Add New Sales Lead/i });
    if (await addLeadBtn.isVisible()) {
      await addLeadBtn.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /Cancel|Discard/i }).click();
      await expect(dialog).not.toBeVisible();
    }
  });

  test("Scenario 4.4: Sales Orders page (order directory, status chips, and detail view)", async ({
    page,
  }) => {
    await page.goto(URLS.orders);
    await page.waitForLoadState("networkidle");

    // Verify Orders table
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 15000 });
    await expect(table.locator("th", { hasText: /SO no\.|Customer|Status/i }).first()).toBeVisible();

    // Verify status filter chips (All, Created, InFulfillment, etc.)
    await expect(page.getByRole("button", { name: /^All$/i }).first()).toBeVisible();

    // Search orders
    const searchInput = page.locator('input[placeholder*="Search SO no"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("SO-");
      await page.waitForTimeout(500);
      await searchInput.clear();
    }

    // Switch to Fulfilment SLA Report tab and back
    const reportTab = page.getByRole("button", { name: /Fulfilment SLA Report/i });
    if (await reportTab.isVisible()) {
      await reportTab.click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /^Orders/i }).click();
      await page.waitForTimeout(500);
    }
  });

  test("Scenario 4.5: Payments Follow-up page (receivables ledger, aging buckets, and search)", async ({
    page,
  }) => {
    await page.goto(URLS.payments);
    await page.waitForLoadState("networkidle");

    // Verify page container (either ledger table or empty filter state with KPI summary)
    const pageIndicator = page.locator("table").or(page.getByText(/No invoices match this filter|Total pending/i)).first();
    await expect(pageIndicator).toBeVisible({ timeout: 15000 });

    // Verify aging headers if table is active
    if (await page.locator("table").isVisible()) {
      await expect(page.locator("th", { hasText: /Invoice|Customer|Aging/i }).first()).toBeVisible();
    }

    // Search filter
    const searchInput = page.locator('input[placeholder*="Search party or ref no"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("INV");
      await page.waitForTimeout(500);
      await searchInput.clear();
    }

    // Switch to Aging Matrix Reports and back
    const agingTab = page.getByRole("button", { name: /Aging Matrix Reports/i });
    if (await agingTab.isVisible()) {
      await agingTab.click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /^Invoices/i }).click();
      await page.waitForTimeout(500);
    }

    // Click customer party name in table and verify Customer 360 drawer loads
    const partyBtn = page.locator("tbody tr td button.font-bold").first();
    if (await partyBtn.isVisible()) {
      const partyName = (await partyBtn.textContent())?.trim();
      await partyBtn.click();
      await page.waitForTimeout(500);

      // Verify drawer opens with customer profile, not 'Customer not found'
      await expect(page.getByText("Customer not found")).not.toBeVisible();
      if (partyName) {
        await expect(page.locator("h3", { hasText: partyName })).toBeVisible({ timeout: 10000 });
      }
      // Close drawer
      await page.locator("button:has(svg.lucide-x)").first().click();
    }
  });

  test("Scenario 4.6: Follow-ups page (actionable timeline, bucket tabs, and modal)", async ({
    page,
  }) => {
    await page.goto(URLS.followups);
    await page.waitForLoadState("networkidle");

    // Verify timeline / page header
    await expect(page.getByRole("heading", { name: /Actionable Timeline/i }).or(page.getByText(/Actionable Timeline/i))).toBeVisible();

    // Filter by entity type within main content area
    const entitySelect = page.locator("main select").first();
    if (await entitySelect.isVisible()) {
      await entitySelect.selectOption({ label: "All entity types" });
    }

    // Search follow-ups
    const searchInput = page.locator('input[placeholder*="Search follow-ups"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("Quote");
      await page.waitForTimeout(500);
      await searchInput.clear();
    }

    // Open Add Follow-up modal if available
    const addBtn = page.getByRole("button", { name: /\+ Add follow-up/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /Cancel|Discard/i }).first().click();
      await expect(dialog).not.toBeVisible();
    }
  });

  test("Scenario 4.7: My Customers directory (account list, search, and detail drawer)", async ({
    page,
  }) => {
    await page.goto(URLS.customers);
    await page.waitForLoadState("networkidle");

    // Verify customer directory table
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 15000 });
    await expect(table.locator("th", { hasText: /Customer/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Area|Location/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Key Contact/i })).toBeVisible();

    // Search customers
    const searchInput = page.locator('input[placeholder*="Search customers"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("TVS");
    await page.waitForTimeout(600);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Click first customer name button to slide open CustomerDrawer
    const firstCustBtn = page.locator("table tbody tr td button").first();
    if (await firstCustBtn.isVisible()) {
      const custName = (await firstCustBtn.textContent())?.trim() || "";
      await firstCustBtn.click();

      // Verify drawer opens showing account details
      const drawerHeading = page.getByRole("heading", { level: 3, name: custName });
      await expect(drawerHeading).toBeVisible({ timeout: 10000 });

      // Dismiss drawer via keyboard escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  });

  test("Scenario 4.8: My Customer Mapping grid (customer-product mapping and search)", async ({
    page,
  }) => {
    await page.goto(URLS.mappings);
    await page.waitForLoadState("networkidle");

    // Verify mapping table
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 15000 });
    await expect(table.locator("th", { hasText: /Customer/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Product/i })).toBeVisible();
    await expect(table.locator("th", { hasText: /Agreed|Catalog|Effective/i }).first()).toBeVisible();

    // Search mappings
    const searchInput = page.locator('input[placeholder*="Search mappings"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("IPOL");
      await page.waitForTimeout(500);
      await searchInput.clear();
    }

    // Map a product button & modal
    const addMappingBtn = page.getByRole("button", { name: /Map a product/i });
    if (await addMappingBtn.isVisible()) {
      await addMappingBtn.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel" }).first().click();
      await expect(dialog).not.toBeVisible();
    }
  });
});
