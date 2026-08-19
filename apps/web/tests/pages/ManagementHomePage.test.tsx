import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ManagementHomePage from "../../src/pages/ManagementHomePage";
import { useManagementStore } from "../../src/store/managementStore";
import { DEFAULT_MANAGEMENT_ID } from "../../src/store/ui";

describe("ManagementHomePage", () => {
  beforeEach(() => {
    useManagementStore.setState({
      managements: [
        {
          id: DEFAULT_MANAGEMENT_ID,
          name: "GreatSales Industrial Corp",
          initials: "GS",
          industry: "Industrial",
          currency: "INR (₹)",
          createdAt: "2026-08-19",
        },
        {
          id: "m_acme",
          name: "Acme Traders",
          initials: "AC",
          industry: "Pharma",
          currency: "INR (₹)",
          createdAt: "2026-08-19",
        },
      ],
      datasets: {},
    });
  });

  it("lists all managements and the create card", () => {
    render(
      <MemoryRouter>
        <ManagementHomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.getByText("GreatSales Industrial Corp")).toBeInTheDocument();
    expect(screen.getByText(/create management/i)).toBeInTheDocument();
  });

  it("filters by search", async () => {
    render(
      <MemoryRouter>
        <ManagementHomePage />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByPlaceholderText(/search managements/i), "acme");
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.queryByText("GreatSales Industrial Corp")).not.toBeInTheDocument();
  });

  it("links a management card to its dashboard", () => {
    render(
      <MemoryRouter>
        <ManagementHomePage />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /acme traders/i });
    expect(link.getAttribute("href")).toBe("/managements/m_acme/dashboard");
  });
});
