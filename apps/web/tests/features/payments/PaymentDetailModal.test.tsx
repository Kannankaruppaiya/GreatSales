import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaymentDetailModal } from "@/features/payments/PaymentDetailModal";
import { useAuth } from "@/store/auth";
import type { PaymentRow } from "@/features/payments/types";
import { permissionsFor } from "../../helpers/authFixtures";

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
    mail1At: null,
    mail2At: null,
    mail3At: null,
    mail4At: null,
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
    user: {
      id: "u_1",
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
  it("hides Save and offers no reminder to send for sales", async () => {
    setRole("sales");
    renderModal();

    expect(screen.queryByRole("button", { name: /save changes/i })).toBeNull();
    // The chase still reads — where it has got to is worth knowing even when
    // you cannot move it — but nothing in the menu can be acted on.
    await userEvent.click(screen.getByRole("button", { name: /Reminders for/i }));
    screen.getAllByRole("menuitem").forEach((item) => expect(item).toBeDisabled());
    // Salesperson/zone fields render as read-only text, not editable Selects.
    expect(screen.queryByLabelText(/salesperson allocation/i)).toBeNull();
  });

  it("shows an enabled Save button and the next reminder for admin", async () => {
    setRole("admin");
    renderModal();

    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: /Reminders for/i }));
    // Nothing has gone yet, so the 1st is the one on offer and the rest wait.
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toBeEnabled();
    expect(items[1]).toBeDisabled();
    expect(screen.getByText("Mark sent")).toBeInTheDocument();
  });
});
