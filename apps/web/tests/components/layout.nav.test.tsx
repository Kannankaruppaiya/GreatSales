import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuth } from "@/store/auth";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

describe("Sidebar links", () => {
  beforeEach(() => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID, sidebarOpen: true });
    useAuth.setState({
      accessToken: "test",
      user: {
        id: "u1",
        tenantId: "tenant_acme",
        name: "Admin",
        email: "admin@acme.test",
        username: "admin",
        roleId: "role_admin",
        role: "admin",
        permissions: ["customer.read", "customer.write", "lead.read", "lead.write", "projection.read", "projection.write", "order.read", "order.write", "payment.read", "payment.write", "user.manage", "role.manage", "report.view"],
        mustChangePassword: false,
      },
    });
  });

  it("leads every nav link with the role, then the active management id", () => {
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Sidebar onOpenCommandPalette={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // The role segment is what makes a signed-in URL say who is signed in, and
    // what RequireRolePath checks. A link that omits it would bounce the user
    // through a redirect on every click.
    const link = screen.getByRole("link", { name: /dashboard/i });
    expect(link.getAttribute("href")).toBe(
      `/admin/managements/${DEFAULT_MANAGEMENT_ID}/dashboard`,
    );
  });
});
