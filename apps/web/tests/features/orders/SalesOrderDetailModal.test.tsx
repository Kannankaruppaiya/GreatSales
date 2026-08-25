import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SalesOrderDetailModal } from "@/features/orders/SalesOrderDetailModal";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import type { OrderRow } from "@/features/orders/types";
import { permissionsFor } from "../../helpers/authFixtures";

function makeOrder(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "ord_1",
    code: "SO-1",
    customerId: "cust_1",
    customerName: "Acme Co",
    salespersonId: "u_sales1",
    salespersonName: "Test Sales",
    createdById: null,
    date: "2026-08-01",
    status: "Acknowledged",
    total: 5000,
    isUrgent: false,
    paymentTerms: "30 Days Credit",
    advanceAmount: null,
    advanceRef: null,
    deliveryMode: "TransportLR",
    deliveryAddress: null,
    expectedDelivery: null,
    transporterName: null,
    lrNumber: null,
    deliveryInstructions: null,
    cancelReason: null,
    cancelledAt: null,
    items: [
      { id: "item_1", productId: "prod_1", productName: "Coolant 20L", qty: 10, price: 500, unit: "Ltr", lineTotal: 5000 },
    ],
    statusHistory: [
      { id: "hist_1", status: "Created", note: null, changedById: "u_1", changedByName: "Test User", at: "2026-08-01T00:00:00.000Z" },
      { id: "hist_2", status: "Acknowledged", note: null, changedById: "u_1", changedByName: "Test User", at: "2026-08-01T01:00:00.000Z" },
    ],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T01:00:00.000Z",
    ...overrides,
  };
}

function setRole(role: "admin" | "mgmt") {
  useAuth.setState({
    accessToken: "test",
    user: {
      id: "u_1",
      tenantId: "tenant_acme",
      name: "Test User",
      email: "test@acme.test",
      username: "test",
      roleId: role === "admin" ? "role_admin" : "role_mgmt",
      role,
      permissions: permissionsFor(role),
      mustChangePassword: false,
    },
  });
}

function renderModal(order: OrderRow) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SalesOrderDetailModal open onClose={() => {}} order={order} />
    </QueryClientProvider>,
  );
}

describe("SalesOrderDetailModal status advance", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setRole("admin");
  });

  it("advances to a status whose label differs from its raw value, and PATCHes the raw value", async () => {
    // From "Acknowledged" the next stage is "DeliveryPartnerAssigned" —
    // label "Delivery Partner Assigned" differs from the raw enum value, so
    // this actually discriminates a label-vs-raw regression (unlike a stage
    // whose label happens to equal its raw value).
    const order = makeOrder({ status: "Acknowledged" });
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ ...order, status: "DeliveryPartnerAssigned" });
    renderModal(order);

    const advanceBtn = await screen.findByRole("button", { name: /mark as delivery partner assigned/i });
    await userEvent.click(advanceBtn);

    await waitFor(() => {
      const patchCall = spy.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall).toBeTruthy();
    });
    const patchCall = spy.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(patchCall[0]).toContain("/orders/ord_1");
    const body = JSON.parse(patchCall[1]!.body as string);
    // OrderUpdateSchema only accepts raw DB enum strings (OrderStatusSchema
    // in packages/shared/src/enums.ts) — sending the display label
    // ("Delivery Partner Assigned") would 400.
    expect(body.status).toBe("DeliveryPartnerAssigned");
  });

  it("cancels with the raw \"Cancelled\" status value and the typed reason", async () => {
    const order = makeOrder({ status: "Acknowledged" });
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ ...order, status: "Cancelled", cancelReason: "Stock out" });
    renderModal(order);

    await userEvent.click(screen.getByRole("button", { name: /cancel order/i }));
    await userEvent.type(screen.getByPlaceholderText(/customer cancelled due to project delay/i), "Stock out");
    await userEvent.click(screen.getByRole("button", { name: /confirm cancellation/i }));

    await waitFor(() => {
      const patchCall = spy.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall).toBeTruthy();
    });
    const patchCall = spy.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    const body = JSON.parse(patchCall[1]!.body as string);
    expect(body.status).toBe("Cancelled");
    expect(body.cancelReason).toBe("Stock out");
  });
});
