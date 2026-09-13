import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddCustomerModal } from "@/features/customers/AddCustomerModal";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import type { CustomerFkOption } from "@/features/customers/AddCustomerModal";
import { permissionsFor } from "../../helpers/authFixtures";

const salespeople = [{ id: "u_sales1", name: "Test Sales" }];

function setRole(role: "admin" | "mgmt" | "sales", userId = "u_1") {
  useAuth.setState({
    accessToken: "test",
    user: {
      id: userId,
      tenantId: "tenant_acme",
      name: "Test User",
      email: "test@acme.test",
      username: "test",
      roleId: role === "admin" ? "role_admin" : role === "sales" ? "role_sales" : "role_mgmt",
      role,
      permissions: permissionsFor(role),
      mustChangePassword: false,
    },
  });
}

function renderModal(
  options: CustomerFkOption[] = salespeople,
  extra: { period?: string; requireMapping?: boolean } = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AddCustomerModal open onClose={() => {}} salespeople={options} {...extra} />
    </QueryClientProvider>,
  );
}

/**
 * A catalogue for the principal / sub-product pickers.
 *
 * Routed by path rather than a single blanket `mockResolvedValue`: the product
 * repeater reads `/principals` as `{ items }` and `/products` as a cursor page,
 * and a mock that answers both with the same object is exactly how an empty
 * picker passes a test.
 */
function mockCatalogue(postResponse: unknown = { id: "cust_x" }) {
  return vi.spyOn(api, "apiFetch").mockImplementation((async (
    path: string,
    init?: RequestInit,
  ) => {
    if (init?.method === "POST") return postResponse;
    if (path.startsWith("/principals")) {
      return { items: [{ id: "prin_1", name: "BALMEROL" }] };
    }
    if (path.startsWith("/products")) {
      return {
        items: [
          {
            id: "prod_1",
            name: "BALMEROL EP 140",
            sku: "EP140",
            principalId: "prin_1",
            principalName: "BALMEROL",
            basePrice: 140,
          },
        ],
        nextCursor: null,
        total: 1,
      };
    }
    return { items: [], nextCursor: null, total: 0 };
  }) as unknown as typeof api.apiFetch);
}

async function pickFirstProduct() {
  await userEvent.selectOptions(
    await screen.findByLabelText(/principal for product row 1/i),
    "prin_1",
  );
  await userEvent.selectOptions(
    screen.getByLabelText(/sub product for product row 1/i),
    "prod_1",
  );
}

describe("AddCustomerModal enum payloads", () => {
  beforeEach(() => vi.restoreAllMocks());
  // The auth store is a module-level singleton — reset it after every test
  // so `setRole("sales", ...)` below can't leak into an unrelated test that
  // never calls setRole itself.
  afterEach(() => useAuth.setState({ accessToken: null, user: null }));

  it("keeps Save enabled for sales even with an EMPTY salesperson options list", async () => {
    // The whole bug: a newly-onboarded salesperson has zero customers yet,
    // so `salespersonOptions` (derived from loaded rows in CustomersPage) is
    // empty. The picker used to gate Save on `selectedSalespersonId`, which
    // fell back to `salespersonOptions[0]?.id` -> "" when the list is empty
    // -> Save permanently disabled. A populated-options test would not catch
    // this at all. The API always forces salespersonId = user.userId for a
    // sales caller (customers.service.ts `create`), so the client doesn't
    // need a picker for `sales`.
    setRole("sales", "u_sales_self");
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "cust_3" });
    renderModal([]);

    expect(screen.queryByText(/no salespersons yet/i)).toBeNull();
    await userEvent.type(
      screen.getByPlaceholderText(/anand automotive/i),
      "Sales Self-Serve Co",
    );
    const saveBtn = screen.getByRole("button", { name: /create customer/i });
    expect(saveBtn).toBeEnabled();

    await userEvent.click(saveBtn);
    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.salespersonId).toBe("u_sales_self");
  });

  it("submits the raw DB enum value for the selected payment-terms label, not the label itself", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "cust_1" });
    renderModal();

    await userEvent.type(
      screen.getByPlaceholderText(/anand automotive/i),
      "Regression Test Co",
    );
    await userEvent.selectOptions(screen.getByLabelText(/^salesperson/i), "Test Sales");

    // Default is already "30 Days Credit" / "Green Zone" (raw Credit30 /
    // GreenZone) — explicitly change both away from the default so this test
    // exercises the label→raw mapping mechanism, not just the default.
    const paymentTermsSelect = screen.getByDisplayValue("30 Days Credit");
    await userEvent.selectOptions(paymentTermsSelect, "45 Days Credit");

    const payZoneSelect = screen.getByDisplayValue("Green Zone");
    await userEvent.selectOptions(payZoneSelect, "Yellow Zone");

    await userEvent.click(screen.getByRole("button", { name: /create customer/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    // The API's CustomerCreateSchema only accepts raw DB enum strings
    // (PaymentTermsSchema / PayZoneSchema in packages/shared/src/enums.ts) —
    // sending the display label ("45 Days Credit") would 400.
    expect(body.paymentTerms).toBe("Credit45");
    expect(body.payZone).toBe("YellowZone");
  });

  it("defaults to a valid raw payment-terms/pay-zone value so an unmodified Create doesn't 400", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "cust_2" });
    renderModal();

    await userEvent.type(
      screen.getByPlaceholderText(/anand automotive/i),
      "Unmodified Defaults Co",
    );
    await userEvent.selectOptions(screen.getByLabelText(/^salesperson/i), "Test Sales");
    await userEvent.click(screen.getByRole("button", { name: /create customer/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.paymentTerms).toBe("Credit30");
    expect(body.payZone).toBe("GreenZone");
  });

  it("blocks Create for admin/mgmt until a salesperson is explicitly chosen — no falling back to whoever sorts first", async () => {
    // The bug this guards: selectedSalespersonId used to fall back to
    // salespersonOptions[0]?.id, so an admin who never touched the field
    // silently created a customer owned by whichever name sorted first
    // alphabetically — active or not. The field is marked required; it must
    // actually behave that way.
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "cust_4" });
    renderModal();

    await userEvent.type(
      screen.getByPlaceholderText(/anand automotive/i),
      "No Owner Chosen Co",
    );
    expect(screen.getByRole("button", { name: /create customer/i })).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText(/^salesperson/i), "Test Sales");
    expect(screen.getByRole("button", { name: /create customer/i })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /create customer/i }));
    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.salespersonId).toBe("u_sales1");
  });
});

describe("AddCustomerModal product onboarding", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => useAuth.setState({ accessToken: null, user: null }));

  it("sends the mapped products and the worksheet month in ONE request", async () => {
    // The point of the whole feature: account, contact, mappings and the blank
    // worksheet lines are one POST, so there is no window in which a customer
    // exists that nothing can be projected against.
    const spy = mockCatalogue();
    renderModal(salespeople, { period: "2026-09", requireMapping: true });

    await userEvent.type(
      screen.getByPlaceholderText(/anand automotive/i),
      "Onboarded With Products",
    );
    await userEvent.selectOptions(screen.getByLabelText(/^salesperson/i), "Test Sales");
    await pickFirstProduct();
    await userEvent.type(
      screen.getByLabelText(/agreed price for product row 1/i),
      "123.5",
    );
    await userEvent.click(screen.getByRole("button", { name: /create customer/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.mappings).toEqual([{ productId: "prod_1", customPrice: 123.5 }]);
    expect(body.period).toBe("2026-09");
  });

  it("leaves the price null so the catalog price applies", async () => {
    const spy = mockCatalogue();
    renderModal(salespeople, { period: "2026-09", requireMapping: true });

    await userEvent.type(
      screen.getByPlaceholderText(/anand automotive/i),
      "Catalog Priced Co",
    );
    await userEvent.selectOptions(screen.getByLabelText(/^salesperson/i), "Test Sales");
    await pickFirstProduct();
    await userEvent.click(screen.getByRole("button", { name: /create customer/i }));

    const body = JSON.parse(
      spy.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body as string,
    );
    expect(body.mappings).toEqual([{ productId: "prod_1", customPrice: null }]);
  });

  it("blocks Create from the worksheet until a product is mapped", async () => {
    // From the projections page a customer with no mapping is invisible — there
    // is no line to show — so the form must not let one be created there.
    mockCatalogue();
    renderModal(salespeople, { period: "2026-09", requireMapping: true });

    await userEvent.type(
      screen.getByPlaceholderText(/anand automotive/i),
      "No Products Yet Co",
    );
    await userEvent.selectOptions(screen.getByLabelText(/^salesperson/i), "Test Sales");
    expect(screen.getByRole("button", { name: /create customer/i })).toBeDisabled();
    expect(screen.getByText(/map at least one sub product/i)).toBeInTheDocument();

    await pickFirstProduct();
    expect(screen.getByRole("button", { name: /create customer/i })).toBeEnabled();
  });

  it("omits mappings and period entirely when no product is picked", async () => {
    // The customers page has no month in view, so it must keep posting the
    // plain customer body it always did.
    const spy = mockCatalogue();
    renderModal();

    await userEvent.type(
      screen.getByPlaceholderText(/anand automotive/i),
      "Plain Customer Co",
    );
    await userEvent.selectOptions(screen.getByLabelText(/^salesperson/i), "Test Sales");
    await userEvent.click(screen.getByRole("button", { name: /create customer/i }));

    const body = JSON.parse(
      spy.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body as string,
    );
    expect(body.mappings).toBeUndefined();
    expect(body.period).toBeUndefined();
  });

  it("refuses to submit the same sub product twice", async () => {
    mockCatalogue();
    renderModal(salespeople, { period: "2026-09", requireMapping: true });

    await userEvent.type(
      screen.getByPlaceholderText(/anand automotive/i),
      "Duplicate Product Co",
    );
    await pickFirstProduct();
    await userEvent.click(screen.getByRole("button", { name: /add product/i }));
    await userEvent.selectOptions(
      screen.getByLabelText(/principal for product row 2/i),
      "prin_1",
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/sub product for product row 2/i),
      "prod_1",
    );

    expect(screen.getByText(/same sub product is mapped twice/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create customer/i })).toBeDisabled();
  });
});
