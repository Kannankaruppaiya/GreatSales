import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "@/components/layout";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuth } from "@/store/auth";

describe("Sidebar links", () => {
  beforeEach(() => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID, sidebarOpen: true });
    useAuth.setState({
      accessToken: "test",
      refreshToken: "test",
      user: {
        id: "u1",
        tenantId: "tenant_acme",
        name: "Admin",
        email: "admin@acme.test",
        username: "admin",
        roleId: "role_admin",
        role: "admin",
      },
    });
  });

  it("prefixes nav links with the active management id", () => {
    render(
      <MemoryRouter>
        <Sidebar onOpenCommandPalette={() => {}} />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /dashboard/i });
    expect(link.getAttribute("href")).toBe(`/managements/${DEFAULT_MANAGEMENT_ID}/dashboard`);
  });
});
