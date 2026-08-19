import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ManagementProvider } from "../../src/components/ManagementProvider";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../../src/store/ui";
import { useManagementStore, emptyDataset } from "../../src/store/managementStore";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/managements/:managementId/dashboard"
          element={
            <ManagementProvider>
              <div>inside</div>
            </ManagementProvider>
          }
        />
        <Route path="/managements" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ManagementProvider", () => {
  beforeEach(() => {
    useUi.setState({ isOwner: true, activeManagementId: DEFAULT_MANAGEMENT_ID });
    useManagementStore.setState({
      managements: [
        {
          id: DEFAULT_MANAGEMENT_ID,
          name: "Default",
          initials: "DF",
          industry: "x",
          currency: "INR (₹)",
          createdAt: "2026-08-19",
        },
        {
          id: "m_acme",
          name: "Acme",
          initials: "AC",
          industry: "Pharma",
          currency: "INR (₹)",
          createdAt: "2026-08-19",
        },
      ],
      datasets: {
        m_acme: emptyDataset({
          name: "Acme",
          subdomain: "m_acme",
          currency: "INR (₹)",
          fiscalYearStart: "April",
        }),
      },
    });
  });

  it("renders children for a valid management the owner may open", () => {
    renderAt("/managements/m_acme/dashboard");
    expect(screen.getByText("inside")).toBeInTheDocument();
    expect(useUi.getState().activeManagementId).toBe("m_acme");
  });

  it("redirects owner to home for an unknown management", () => {
    renderAt("/managements/m_ghost/dashboard");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("blocks a non-owner from another management (never switches to it)", () => {
    useUi.setState({ isOwner: false, activeManagementId: DEFAULT_MANAGEMENT_ID });
    renderAt("/managements/m_acme/dashboard");
    // Blocked: redirected back to their own management, never switched to m_acme.
    expect(useUi.getState().activeManagementId).toBe(DEFAULT_MANAGEMENT_ID);
  });
});
