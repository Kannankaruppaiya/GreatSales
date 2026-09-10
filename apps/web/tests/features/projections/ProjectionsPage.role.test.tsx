import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProjectionsPage from "@/features/projections/ProjectionsPage";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import type { ProjectionListResponse } from "@/features/projections/types";
import { permissionsFor } from "../../helpers/authFixtures";


const LINE = {
  id: "pl1",
  period: "2026-06",
  customerId: "cust1",
  customerName: "Acme Corp Customer One",
  contactName: null,
  tier: null,
  productId: "prod1",
  productName: "HYDROPAC AW 68",
  principalId: "p1",
  principalName: "CASTROL",
  salespersonId: "u2",
  salespersonName: "Megala",
  price: 160,
  committedQty: 10,
  achievedQty: 4,
  projValue: 1600,
  achValue: 640,
  achPct: 40,
  status: "ProjectionCreated" as const,
  probability: null,
  nextFollowUp: null,
  targetDate: null,
  salesOrderId: null,
  salesOrderStatus: null,
};

const RESPONSE: ProjectionListResponse = {
  lines: [LINE],
  summary: {
    totLines: 1,
    totCommitted: 1600,
    totAchieved: 640,
    totPct: 40,
  },
};

function setRole(role: "admin" | "sales") {
  useAuth.setState({
    accessToken: "test",
    user: {
      id: "u2",
      tenantId: "tenant_acme",
      name: "Megala",
      email: "megala@acme.test",
      username: "megala",
      roleId: `role_${role}`,
      role,
      permissions: permissionsFor(role),
      mustChangePassword: false,
    },
  });
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProjectionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProjectionsPage salesperson column", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useUi.setState({
      activeManagementId: DEFAULT_MANAGEMENT_ID,
      granularity: "month",
      anchor: "2026-06-01",
      principalId: "ALL",
    });
    vi.spyOn(api, "apiFetch").mockResolvedValue(RESPONSE);
  });

  it("shows the Salesperson column for an admin", async () => {
    setRole("admin");
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("columnheader", { name: /salesperson/i }),
      ).toBeInTheDocument(),
    );
  });

  it("hides the Salesperson column for a salesperson", async () => {
    setRole("sales");
    renderPage();
    // Assert rows have actually rendered BEFORE asserting the column's
    // absence — otherwise a null columnheader is indistinguishable from
    // the page being stuck in its loading state.
    await waitFor(() =>
      expect(screen.getByText("Acme Corp Customer One")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("columnheader", { name: /salesperson/i }),
    ).toBeNull();
  });
});
