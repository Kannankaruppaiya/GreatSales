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
    overdueDays: 0,
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
    // Answered by PATH, not by call order. The page asks for its follow-ups as
    // well as its invoices, and two `mockImplementationOnce`s in a row handed
    // one of the payment pages to whichever query happened to fire first — a
    // mock that breaks every time the page gains a request is a mock that is
    // testing the order of useEffects rather than the behaviour.
    let payPage = 0;
    const spy = vi.spyOn(api, "apiFetch").mockImplementation((path) => {
      if (String(path).startsWith("/followups"))
        return Promise.resolve({ items: [], nextCursor: null });
      payPage += 1;
      return Promise.resolve(
        payPage === 1
          ? { items: [page1], nextCursor: "c1" }
          : { items: [page2], nextCursor: null },
      );
    });

    renderPage();

    // Once both pages have loaded, "Total pending" reflects the SUM
    // (1000 + 500 = 1500 -> "₹1.5K"), not just the first page's 1000
    // ("₹1.0K"). This is the accurate-aggregate fix: nothing should ever
    // settle on a partial total.
    await waitFor(() => expect(screen.getByText("₹1.5K")).toBeTruthy());
    const payCalls = spy.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.startsWith("/payments"));
    expect(payCalls).toHaveLength(2);
    // The second call paged in via the cursor from page 1.
    expect(payCalls[1]).toContain("cursor=c1");
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
    expect(screen.queryByText(/Add Invoice/i)).toBeNull();
    // The reminder dropdown opens for everyone — where the chase has got to is
    // worth reading even when you cannot move it — but nothing inside it may
    // be actionable. Not just for mgmt: for sales too.
    await userEvent.click(screen.getByRole("button", { name: /Reminders for INV-1/i }));
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(4);
    items.forEach((item) => expect(item).toBeDisabled());
    expect(
      screen.getByText(/Read-only — reminders are sent by the collections team/i),
    ).toBeInTheDocument();
  });

  describe("the reminder dropdown", () => {
    it("says how far the chase has got instead of four unlabelled chips", async () => {
      setRole("admin");
      const row = makePayment({ mail1: true, mail1At: "2026-07-04T09:00:00.000Z" });
      vi.spyOn(api, "apiFetch").mockResolvedValue({ items: [row], nextCursor: null });
      renderPage();

      await screen.findByText("INV-1");
      await userEvent.click(screen.getByRole("button", { name: /Reminders for INV-1/i }));
      expect(screen.getByText("1st sent")).toBeInTheDocument();
      expect(screen.getByText(/Sent 04 Jul/)).toBeInTheDocument();
      expect(screen.getByText("Next: 2nd reminder.")).toBeInTheDocument();
    });

    it("offers only the next letter, and sends the flag without a date", async () => {
      setRole("admin");
      const row = makePayment({ mail1: true, mail1At: "2026-07-04T09:00:00.000Z" });
      const fetch = vi
        .spyOn(api, "apiFetch")
        .mockResolvedValue({ items: [row], nextCursor: null });
      renderPage();

      await screen.findByText("INV-1");
      await userEvent.click(screen.getByRole("button", { name: /Reminders for INV-1/i }));
      const items = screen.getAllByRole("menuitem");
      // 1st is the last one sent, so it can be taken back; 2nd is next; the
      // 3rd and 4th are out of order and must not be reachable — marking one
      // notifies the collector about a letter that was never written.
      expect(items[0]).toBeEnabled();
      expect(items[1]).toBeEnabled();
      expect(items[2]).toBeDisabled();
      expect(items[3]).toBeDisabled();

      fetch.mockClear();
      await userEvent.click(items[1]);
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/payments/pmt_1",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ mail2: true }),
          }),
        );
      });
    });

    it("takes back the most recent letter", async () => {
      setRole("admin");
      const row = makePayment({
        mail1: true,
        mail2: true,
        mail1At: "2026-07-04T09:00:00.000Z",
        mail2At: "2026-07-20T09:00:00.000Z",
      });
      const fetch = vi
        .spyOn(api, "apiFetch")
        .mockResolvedValue({ items: [row], nextCursor: null });
      renderPage();

      await screen.findByText("INV-1");
      await userEvent.click(screen.getByRole("button", { name: /Reminders for INV-1/i }));
      fetch.mockClear();
      await userEvent.click(screen.getAllByRole("menuitem")[1]);
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/payments/pmt_1",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ mail2: false }),
          }),
        );
      });
    });

    it("says a letter is sent without inventing a date it does not have", async () => {
      setRole("admin");
      // Marked sent before the timestamp column existed.
      const row = makePayment({ mail1: true, mail1At: null });
      vi.spyOn(api, "apiFetch").mockResolvedValue({ items: [row], nextCursor: null });
      renderPage();

      await screen.findByText("INV-1");
      await userEvent.click(screen.getByRole("button", { name: /Reminders for INV-1/i }));
      expect(screen.getByText("Sent")).toBeInTheDocument();
      expect(screen.queryByText(/Sent \d/)).toBeNull();
    });
  });
});
