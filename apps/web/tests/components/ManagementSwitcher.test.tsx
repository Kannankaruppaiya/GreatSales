import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ManagementSwitcher } from "../../src/components/ManagementSwitcher";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../../src/store/ui";
import { useAuth } from "../../src/store/auth";
import { useManagementStore } from "../../src/store/managementStore";

function seedAuth(role: "super_admin" | "admin") {
  useAuth.setState({
    accessToken: "test",
    refreshToken: "test",
    user: {
      id: "u1",
      tenantId: "tenant_acme",
      name: "User",
      email: "user@acme.test",
      username: "user",
      roleId: `role_${role}`,
      role,
    },
  });
}

describe("ManagementSwitcher", () => {
  beforeEach(() => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID });
    seedAuth("super_admin");
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

  it("hides for non-owners", () => {
    seedAuth("admin");
    const { container } = render(
      <MemoryRouter>
        <ManagementSwitcher />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("owner sees current management and can open the menu", async () => {
    render(
      <MemoryRouter>
        <ManagementSwitcher />
      </MemoryRouter>,
    );
    expect(screen.getByText("GreatSales Industrial Corp")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /switch management/i }));
    const link = screen.getByRole("link", { name: /acme traders/i });
    expect(link.getAttribute("href")).toBe("/managements/m_acme/dashboard");
    expect(
      screen.getByRole("link", { name: /back to all managements/i }).getAttribute("href"),
    ).toBe("/managements");
  });
});
