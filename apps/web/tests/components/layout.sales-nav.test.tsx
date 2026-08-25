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

function renderSidebar() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Sidebar onOpenCommandPalette={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Sidebar for the sales role", () => {
  beforeEach(() => {
    useUi.setState({
      activeManagementId: DEFAULT_MANAGEMENT_ID,
      sidebarOpen: true,
    });
    useAuth.setState({
      accessToken: "test",
      user: {
        id: "u2",
        tenantId: "tenant_acme",
        name: "Megala",
        email: "megala@acme.test",
        username: "megala",
        roleId: "role_sales",
        role: "sales",
        permissions: ["customer.read", "customer.write", "lead.read", "lead.write", "projection.read", "projection.write", "order.read", "order.write", "payment.read"],
        mustChangePassword: false,
      },
    });
  });

  it("shows the seven POC sales nav items", () => {
    renderSidebar();
    for (const label of [
      /dashboard/i,
      /recurring/i,
      /new sales customers/i,
      /sales orders/i,
      /payments follow-up/i,
      /follow-ups/i,
      /my customers/i,
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("hides the admin-only modules from a salesperson", () => {
    renderSidebar();
    expect(screen.queryByRole("link", { name: /^users$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^data$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^products$/i })).toBeNull();
  });
});
