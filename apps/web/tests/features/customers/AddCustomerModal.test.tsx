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

function renderModal(options: CustomerFkOption[] = salespeople) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AddCustomerModal open onClose={() => {}} salespeople={options} />
    </QueryClientProvider>,
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
    await userEvent.click(screen.getByRole("button", { name: /create customer/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.paymentTerms).toBe("Credit30");
    expect(body.payZone).toBe("GreenZone");
  });
});
