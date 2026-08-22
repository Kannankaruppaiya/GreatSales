import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  CreateSalesOrderModal,
  type OrderSalespersonOption,
} from "@/features/orders/CreateSalesOrderModal";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";

const customers = [{ id: "cust_1", name: "Anand Automotive" }];
const products = [{ id: "prod_1", name: "Coolant 20L", price: 500, unit: "Ltr" }];
const salespeople = [{ id: "u_sales1", name: "Test Sales" }];

function setRole(role: "admin" | "mgmt" | "sales", userId = "u_1") {
  useAuth.setState({
    accessToken: "test",
    refreshToken: "test",
    user: {
      id: userId,
      tenantId: "tenant_acme",
      name: "Test User",
      email: "test@acme.test",
      username: "test",
      roleId: role === "admin" ? "role_admin" : role === "sales" ? "role_sales" : "role_mgmt",
      role,
    },
  });
}

function renderModal(salespersonOptions: OrderSalespersonOption[] = salespeople) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CreateSalesOrderModal
        open
        onClose={() => {}}
        customers={customers}
        products={products}
        salespeople={salespersonOptions}
      />
    </QueryClientProvider>,
  );
}

describe("CreateSalesOrderModal enum payloads", () => {
  beforeEach(() => vi.restoreAllMocks());
  // The auth store is a module-level singleton — reset it after every test
  // so setRole("sales", ...) below can't leak into a test that never calls it.
  afterEach(() => useAuth.setState({ accessToken: null, refreshToken: null, user: null }));

  it("keeps Save enabled for sales even with an EMPTY salesperson options list", async () => {
    // Same bug shape as AddCustomerModal/AddLeadModal: a newly-onboarded
    // salesperson has zero orders yet, so `salespeople` (derived from loaded
    // rows in OrdersPage) is empty. The API always forces
    // salespersonId = user.userId for a sales caller (orders.service.ts
    // `create`), so the client doesn't need a picker for `sales`.
    setRole("sales", "u_sales_self");
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "ord_3" });
    renderModal([]);

    expect(screen.queryByText(/no salespersons yet/i)).toBeNull();
    const saveBtn = screen.getByRole("button", { name: /create sales order/i });
    expect(saveBtn).toBeEnabled();

    await userEvent.click(saveBtn);
    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.salespersonId).toBe("u_sales_self");
  });

  it("submits the raw DB enum value for the selected delivery-mode label, not the label itself", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "ord_1" });
    renderModal();

    // Default delivery mode is already "Transport (LR)" (raw TransportLR) —
    // explicitly change it to "Company Vehicle" (raw CompanyVehicle), a
    // label that DIFFERS from its raw value (unlike "Courier", whose label
    // and raw value are both literally "Courier" — that choice would pass
    // whether the code sent the raw value or the label, so it can't catch a
    // label-vs-raw regression). CompanyVehicle actually discriminates.
    const deliveryModeSelect = screen.getByDisplayValue("Transport (LR)");
    await userEvent.selectOptions(deliveryModeSelect, "Company Vehicle");

    await userEvent.click(screen.getByRole("button", { name: /create sales order/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    // OrderCreateSchema only accepts raw DB enum strings (DeliveryModeSchema
    // in packages/shared/src/enums.ts) — sending the display label
    // ("Company Vehicle") would 400.
    expect(body.deliveryMode).toBe("CompanyVehicle");
    // total must never be sent — it's server-computed from items.
    expect(body.total).toBeUndefined();
  });

  it("defaults to a valid raw delivery-mode value so an unmodified Create doesn't 400", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "ord_2" });
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: /create sales order/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.deliveryMode).toBe("TransportLR");
  });
});
