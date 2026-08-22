import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaymentDetailModal } from "@/features/payments/PaymentDetailModal";
import { useAuth } from "@/store/auth";
import type { PaymentRow } from "@/features/payments/types";

function makePayment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "pmt_1",
    refNo: "INV-1",
    customerId: "cust_1",
    customerName: "Acme Co",
    salespersonId: "u_sales1",
    salespersonName: "Test Sales",
    invoiceNo: "INV-1",
    invoiceDate: "2026-07-01",
    amount: 1000,
    received: 0,
    pending: 1000,
    dueDate: "2026-07-31",
    agingDays: 20,
    payZone: "GreenZone",
    delayReason: null,
    nextFollowUp: null,
    mail1: false,
    mail2: false,
    mail3: false,
    mail4: false,
    status: "Pending",
    followups: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function setRole(role: "admin" | "mgmt" | "sales") {
  useAuth.setState({
    accessToken: "test",
    refreshToken: "test",
    user: {
      id: "u_1",
      tenantId: "tenant_acme",
      name: "Test User",
      email: "test@acme.test",
      username: "test",
      roleId: role === "admin" ? "role_admin" : role === "sales" ? "role_sales" : "role_mgmt",
      role,
    },
  });
}

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PaymentDetailModal open onClose={() => {}} payment={makePayment()} salespeople={[]} />
    </QueryClientProvider>,
  );
}

describe("PaymentDetailModal write gate", () => {
  beforeEach(() => vi.restoreAllMocks());

  // `sales` holds `payment.read` but NOT `payment.write` — PATCH /payments/:id
  // 403s for a sales caller. Unlike sibling detail modals (Lead/SalesOrder),
  // this canEdit must NOT be `role !== "mgmt"`. Mutation-proof: reverting
  // canEdit to `role !== "mgmt"` makes this test fail (verified in the fix
  // report).
  it("hides Save and disables reminder chips for sales", () => {
    setRole("sales");
    renderModal();

    expect(screen.queryByRole("button", { name: /save changes/i })).toBeNull();
    for (let i = 1; i <= 4; i++) {
      expect(screen.getByRole("button", { name: `Reminder ${i}` })).toBeDisabled();
    }
    // Salesperson/zone fields render as read-only text, not editable Selects.
    expect(screen.queryByLabelText(/salesperson allocation/i)).toBeNull();
  });

  it("shows an enabled Save button and editable fields for admin", () => {
    setRole("admin");
    renderModal();

    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reminder 1" })).toBeEnabled();
  });
});
