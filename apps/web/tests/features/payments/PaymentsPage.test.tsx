import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PaymentsPage from "@/features/payments/PaymentsPage";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import type { PaymentRow } from "@/features/payments/types";
import { permissionsFor } from "../../helpers/authFixtures";

function makePayment(overrides: Partial<PaymentRow>): PaymentRow {
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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PaymentsPage />
    </QueryClientProvider>,
  );
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

describe("PaymentsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setRole("mgmt");
  });

  it("auto-fetches every page before showing KPI totals, instead of only the first page", async () => {
    const page1 = makePayment({ id: "pmt_1", pending: 1000 });
    const page2 = makePayment({ id: "pmt_2", pending: 500 });
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockImplementationOnce(() => Promise.resolve({ items: [page1], nextCursor: "c1" }))
      .mockImplementationOnce(() => Promise.resolve({ items: [page2], nextCursor: null }));

    renderPage();

    // Once both pages have loaded, "Total pending" reflects the SUM
    // (1000 + 500 = 1500 -> "₹1.5K"), not just the first page's 1000
    // ("₹1.0K"). This is the accurate-aggregate fix: nothing should ever
    // settle on a partial total.
    await waitFor(() => expect(screen.getByText("₹1.5K")).toBeTruthy());
    expect(spy).toHaveBeenCalledTimes(2);
    // The second call paged in via the cursor from page 1.
    expect(spy.mock.calls[1][0]).toContain("cursor=c1");
    // No stale "loaded" partial-total wording is left once totals are complete.
    expect(screen.queryByText(/loading full totals/i)).toBeNull();
  });

  it("shows an admin-only delete action that confirms before calling DELETE", async () => {
    setRole("admin");
    const row = makePayment({ id: "pmt_del", refNo: "INV-DEL" });
    const spy = vi.spyOn(api, "apiFetch").mockImplementation((_path, init) => {
      const method = init?.method ?? "GET";
      if (method === "DELETE") return Promise.resolve(undefined);
      return Promise.resolve({ items: [row], nextCursor: null });
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();

    const deleteBtn = await screen.findByTitle("Delete invoice");
    await userEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("INV-DEL"));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("/payments/pmt_del"),
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("does not show the delete action to a non-admin role", async () => {
    setRole("mgmt");
    const row = makePayment({ id: "pmt_1" });
    vi.spyOn(api, "apiFetch").mockResolvedValue({ items: [row], nextCursor: null });

    renderPage();

    await screen.findByText("INV-1");
    expect(screen.queryByTitle("Delete invoice")).toBeNull();
  });

  // `sales` holds `payment.read` but NOT `payment.write` (rbac.ts) — the API
  // 403s any PATCH/POST/DELETE to /payments from a sales caller. Unlike every
  // sibling page, canEdit here must NOT be `role !== "mgmt"` (that would be
  // true for sales and show controls that always 403). The mutation this
  // guards against: reverting PaymentsPage's `canEdit` back to
  // `role !== "mgmt"` makes this test fail (verified below).
  it("hides write affordances from sales (would 403 on payment.write)", async () => {
    setRole("sales");
    const row = makePayment({ id: "pmt_1", mail1: false });
    vi.spyOn(api, "apiFetch").mockResolvedValue({ items: [row], nextCursor: null });

    renderPage();

    await screen.findByText("INV-1");
    expect(screen.queryByText("Import Tally Excel")).toBeNull();
    expect(screen.queryByText("+ Add Invoice")).toBeNull();
    // The 4 reminder chips render for everyone (read-only view), but must be
    // disabled — not just for mgmt, but for sales too.
    for (let i = 1; i <= 4; i++) {
      expect(screen.getByTitle(`Reminder ${i} sent`)).toBeDisabled();
    }
  });
});
