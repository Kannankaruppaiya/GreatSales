import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "@/features/dashboard/DashboardPage";
import { useAuth } from "@/store/auth";
import { useUi } from "@/store/ui";
import * as api from "@/lib/api";
import type { ProjectionListResponse } from "@/features/projections/types";
import type { LeadRow } from "@/features/leads/types";
import { permissionsFor } from "../../helpers/authFixtures";

function makeLead(overrides: Partial<LeadRow>): LeadRow {
  return {
    id: "lead_1",
    customerName: "Acme Co",
    division: null,
    tier: "Gold",
    type: "New",
    salespersonId: "u_sales1",
    salespersonName: "Test Sales",
    stage: "NewEnquiries",
    leadStatus: null,
    industryId: null,
    industryName: null,
    subIndustry: null,
    area: null,
    address: null,
    contactName: "Contact Person",
    phone: "9999999999",
    whatsapp: null,
    sameAsMobile: false,
    email: null,
    nextFollowUp: null,
    expClose: null,
    stageUpdatedAt: null,
    products: [],
    totalValue: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setRole("mgmt");
    useUi.setState({ month: "2026-08", principalId: "ALL", ownerFilter: "ALL" });
  });

  it("renders KPI totals composed from the projections server summary and the fetched leads", async () => {
    const projResponse: ProjectionListResponse = {
      lines: [],
      summary: { totLines: 3, totCommitted: 500000, totAchieved: 200000, totPct: 40 },
    };
    const lead = makeLead({ id: "lead_1", stage: "NewEnquiries", totalValue: 100000 });

    vi.spyOn(api, "apiFetch").mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.startsWith("/projections")) return Promise.resolve(projResponse);
      if (p.startsWith("/leads")) return Promise.resolve({ items: [lead], nextCursor: null });
      return Promise.reject(new Error(`unexpected path ${p}`));
    });

    renderPage();

    // "Recurring committed" is rendered straight from the server summary
    // (500000 -> "₹5.0L"), never recomputed from line items.
    await waitFor(() => expect(screen.getByText("₹5.0L")).toBeTruthy());
    // "Total committed" = recurring summary (5,00,000) + new-sales lead
    // totalValue (1,00,000) = 6,00,000 -> "₹6.0L".
    await waitFor(() => expect(screen.getByText("₹6.0L")).toBeTruthy());
  });

  it("fetches every leads page before finalizing KPI totals, not just the first page", async () => {
    const projResponse: ProjectionListResponse = {
      lines: [],
      summary: { totLines: 0, totCommitted: 0, totAchieved: 0, totPct: null },
    };
    // Different salespeople on each page so the per-salesperson chart bars
    // (₹1.0L / ₹0.5L) don't also coincidentally read "₹1.5L" — keeps the
    // assertion below unambiguous about which two elements it's counting.
    const leadPage1 = makeLead({ id: "lead_1", totalValue: 100000 });
    const leadPage2 = makeLead({
      id: "lead_2",
      totalValue: 50000,
      salespersonId: "u_sales2",
      salespersonName: "Test Sales 2",
    });

    const spy = vi.spyOn(api, "apiFetch").mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.startsWith("/projections")) return Promise.resolve(projResponse);
      if (p.startsWith("/leads")) {
        if (p.includes("cursor=c1")) return Promise.resolve({ items: [leadPage2], nextCursor: null });
        return Promise.resolve({ items: [leadPage1], nextCursor: "c1" });
      }
      return Promise.reject(new Error(`unexpected path ${p}`));
    });

    renderPage();

    // 1,00,000 + 50,000 = 1,50,000 -> "₹1.5L". Both "New sales committed" and
    // "Total committed" should reflect the FULL 2-page sum once loaded, not
    // just page 1's 1,00,000 ("₹1.0L").
    await waitFor(() => expect(screen.getAllByText("₹1.5L").length).toBe(2));
    expect(spy.mock.calls.filter((c) => String(c[0]).startsWith("/leads")).length).toBe(2);
  });

  it("does not read from the mock tracker store", () => {
    const src = DashboardPage.toString();
    expect(src).not.toMatch(/useTrackerStore|useTracker/);
  });
});
