import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import ManagementHomePage from "../../src/pages/ManagementHomePage";
import { useManagementStore } from "../../src/store/managementStore";
import { useTrackerStore } from "../../src/store/trackerStore";
import { DEFAULT_MANAGEMENT_ID } from "../../src/store/ui";
import type { User } from "../../src/data/types";

const ACME = {
  id: "m_acme",
  name: "Acme Traders",
  initials: "AC",
  industry: "Pharma",
  currency: "INR (₹)",
  createdAt: "2026-08-19",
};

const DEFAULT_WORKSPACE = {
  id: DEFAULT_MANAGEMENT_ID,
  name: "GreatSales Industrial Corp",
  initials: "GS",
  industry: "Industrial",
  currency: "INR (₹)",
  createdAt: "2026-08-19",
};

/** Surfaces the current router pathname so navigation can be asserted. */
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("ManagementHomePage", () => {
  beforeEach(() => {
    useManagementStore.setState({
      managements: [DEFAULT_WORKSPACE, ACME],
      datasets: {},
    });
  });

  it("lists all workspaces and the create-workspace action", () => {
    render(
      <MemoryRouter>
        <ManagementHomePage />
      </MemoryRouter>,
    );
    // Overview tab (default) surfaces every workspace in the Workspaces pod.
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.getByText("GreatSales Industrial Corp")).toBeInTheDocument();
    expect(screen.getByText(/create workspace/i)).toBeInTheDocument();
  });

  it("filters salespeople by search on the sales-team tab", async () => {
    const reps: User[] = [
      { id: "u_anitha", name: "Anitha Kumar", email: "anitha@greatsales.test", role: "sales", active: true, lastLogin: null },
      { id: "u_bala", name: "Bala Suresh", email: "bala@greatsales.test", role: "sales", active: true, lastLogin: null },
    ];
    useTrackerStore.setState({ users: reps });

    render(
      <MemoryRouter>
        <ManagementHomePage />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /sales team performance/i }));
    expect(screen.getByText("Anitha Kumar")).toBeInTheDocument();
    expect(screen.getByText("Bala Suresh")).toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText(/search salesperson or workspace/i),
      "anitha",
    );
    expect(screen.getByText("Anitha Kumar")).toBeInTheDocument();
    expect(screen.queryByText("Bala Suresh")).not.toBeInTheDocument();
  });

  it("launches a workspace to its dashboard", async () => {
    // Isolate to a single workspace so the Launch control is unambiguous.
    useManagementStore.setState({ managements: [ACME], datasets: {} });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <ManagementHomePage />
        <LocationDisplay />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /launch/i }));
    expect(screen.getByTestId("location")).toHaveTextContent("/managements/m_acme/dashboard");
  });
});
