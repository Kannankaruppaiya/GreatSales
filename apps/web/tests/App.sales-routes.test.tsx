import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuth } from "@/store/auth";

function renderAt(path: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("route guards for the sales role", () => {
  beforeEach(() => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID, sidebarOpen: true });
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

  it.each(["users", "data", "products"])(
    "blocks a salesperson from /%s",
    async (segment) => {
      renderAt(`/managements/tenant_acme/${segment}`);
      // 5s, not the 1000ms default: two lazy boundaries now sit between render
      // and this assertion — the route page, and ManagementProvider, which was
      // made lazy so the POC dataset it reaches stays out of the pre-login
      // entry chunk. Measured runs landed at 686-1097ms, i.e. right on the
      // default line, which surfaced as a FLAKY failure rather than a
      // consistent one.
      await waitFor(
        () => expect(screen.getByText(/access restricted/i)).toBeInTheDocument(),
        { timeout: 5000 },
      );
    },
  );
});
