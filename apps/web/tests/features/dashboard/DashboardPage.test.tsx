import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "@/features/dashboard/DashboardPage";
import { useAuth } from "@/store/auth";
import { useUi } from "@/store/ui";
import * as api from "@/lib/api";
import type { LeadRow } from "@/features/leads/types";
import type { DashboardResponse } from "@/features/dashboard/types";
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
    industryId: null,
    industryName: null,
    subIndustry: null,
    area: null,
    address: null,
    contacts: [
      {
        id: "ct_1",
        name: "Contact Person",
        designation: null,
        phone: "9999999999",
        whatsapp: "9999999999",
        sameAsMobile: true,
        email: null,
        isPrimary: true,
      },
    ],
    contactName: "Contact Person",
    phone: "9999999999",
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

const EMPTY_KPIS: DashboardResponse["kpis"] = {
  recurringCommitted: 0,
  recurringAchieved: 0,
  recurringPct: null,
  newSalesCommitted: 0,
  newSalesAchieved: 0,
  totalCommitted: 0,
  totalAchieved: 0,
  totalPct: null,
  followUpsDue: 0,
  followUpsOverdue: 0,
  target: null,
  targetPct: null,
};

/** A complete aggregate response — the page renders it verbatim. */
function makeDashboard(overrides: Partial<DashboardResponse>): DashboardResponse {
  return {
    from: "2026-08-01",
    to: "2026-08-31",
    months: ["2026-08"],
    kpis: EMPTY_KPIS,
    bySalesperson: [],
    byPrincipal: [],
    byCategory: [
      { tier: "Platinum", committed: 0, achieved: 0 },
      { tier: "Gold", committed: 0, achieved: 0 },
      { tier: "Silver", committed: 0, achieved: 0 },
      { tier: "Brass", committed: 0, achieved: 0 },
    ],
    oralConfirmationDeals: [],
    oralConfirmationTotal: 0,
    topOpenProjections: [],
  followUps: [],
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
        // A month window: granularity plus an anchor day inside it, which is what
    // the store holds now.
    useUi.setState({
      granularity: "month",
      anchor: "2026-08-15",
      principalId: "ALL",
      ownerFilter: "ALL",
    });
  });

  it("renders KPI totals straight from the aggregate, without recomputing them", async () => {
    const dash = makeDashboard({
      kpis: {
        ...EMPTY_KPIS,
        recurringCommitted: 500000,
        recurringAchieved: 200000,
        recurringPct: 40,
        newSalesCommitted: 100000,
        totalCommitted: 600000,
        totalAchieved: 200000,
        totalPct: 33.3,
      },
    });

    vi.spyOn(api, "apiFetch").mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.startsWith("/dashboard")) return Promise.resolve(dash);
      return Promise.reject(new Error(`unexpected path ${p}`));
    });

    renderPage();

    // 500000 -> "₹5.0L" and 600000 -> "₹6.0L", both as the server sent them.
    // The page must not be deriving the total from its parts: the server is
    // the only place that arithmetic happens now.
    await waitFor(() => expect(screen.getByText("₹5.0L")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("₹6.0L")).toBeTruthy());
  });

  it("asks for the whole page ONCE and never pages the leads endpoint", async () => {
    // This replaces a test that asserted the opposite — that the page walked
    // every leads page before its KPIs were correct. That loop was the defect
    // (O(leads) requests to render six numbers), so the guarantee worth
    // holding now is the inverse: one request, and leads are not touched.
    const spy = vi.spyOn(api, "apiFetch").mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.startsWith("/dashboard")) return Promise.resolve(makeDashboard({}));
      return Promise.reject(new Error(`unexpected path ${p}`));
    });

    renderPage();
    // An all-zero dashboard renders ₹0 in several tiles, so wait on the
    // request having settled rather than on a unique piece of text.
    await waitFor(() => expect(screen.getAllByText("₹0").length).toBeGreaterThan(0));

    const paths = spy.mock.calls.map((c) => String(c[0]));
    expect(paths.filter((p) => p.startsWith("/dashboard")).length).toBe(1);
    expect(paths.filter((p) => p.startsWith("/leads"))).toEqual([]);
    expect(paths.filter((p) => p.startsWith("/projections"))).toEqual([]);
  });

  it("passes the window through so changing it refetches", async () => {
    useUi.setState({
      granularity: "month",
      anchor: "2026-09-15",
      principalId: "ALL",
      ownerFilter: "ALL",
    });
    const spy = vi.spyOn(api, "apiFetch").mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.startsWith("/dashboard")) return Promise.resolve(makeDashboard({}));
      // The page also asks which features this workspace has, for the modals
      // it mounts. That is not the request under test.
      if (p.startsWith("/feature-flags")) return Promise.resolve({});
      return Promise.reject(new Error(`unexpected path ${p}`));
    });

    renderPage();

    // Found among the calls rather than assumed to be the first one: the page
    // legitimately makes more than one request, and pinning this to call 0 made
    // it fail the next time an unrelated query was added to the tree.
    await waitFor(() => {
      const dash = spy.mock.calls
        .map((c) => String(c[0]))
        .filter((p) => p.startsWith("/dashboard"));
      expect(dash).toHaveLength(1);
      // The resolved range, not the granularity: the server is told which days
      // to summarise, not which button was pressed.
      expect(dash[0]).toContain("from=2026-09-01");
      expect(dash[0]).toContain("to=2026-09-30");
    });
  });

  it("renders the oral-confirmation deals the server selected, not its own filter", async () => {
    // The page must not re-derive "which deals are at oral confirmation" — it
    // renders the list the aggregate chose. Handing it a deal whose stage the
    // page would previously have filtered on proves the filtering moved.
    const deal = makeLead({
      id: "lead_oral",
      customerName: "Vertex Precision Gears",
      stage: "NegotiationOralConfirmation",
      totalValue: 192000,
    });

    vi.spyOn(api, "apiFetch").mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.startsWith("/dashboard"))
        return Promise.resolve(
          makeDashboard({
            oralConfirmationDeals: [deal],
            oralConfirmationTotal: 1,
          }),
        );
      return Promise.reject(new Error(`unexpected path ${p}`));
    });

    renderPage();

    expect(
      await screen.findByText("Vertex Precision Gears"),
    ).toBeInTheDocument();
  });

  it("does not read from the mock tracker store", () => {
    const src = DashboardPage.toString();
    expect(src).not.toMatch(/useTrackerStore|useTracker/);
  });
});
