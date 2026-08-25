import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuth } from "@/store/auth";

// `App` is normally wrapped in a QueryClientProvider by main.tsx. This test
// renders `<App />` directly (bypassing main.tsx), and since Task 4 the
// globally-mounted `CustomerDrawer` (rendered from `layout.tsx` on every
// route) calls a react-query hook, so a provider is required here too —
// same fix as tests/pages/UsersPage.addUser.test.tsx.
function renderApp(initialEntries: string[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Two lazy boundaries now sit between render and this assertion: the route
// page, and ManagementProvider (made lazy so the POC dataset it reaches
// stays out of the pre-login entry chunk). testing-library's default
// findBy timeout is 1000ms and these runs measured 868-1097ms, i.e. right
// on the line — which showed up as a flaky failure, not a consistent one.
// The wait is explicit rather than global so the reason travels with it.
describe("App routing", () => {
  beforeEach(() => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID });
    useAuth.setState({
      accessToken: "test",
      user: {
        id: "u1",
        tenantId: "tenant_acme",
        name: "Owner",
        email: "owner@acme.test",
        username: "owner",
        roleId: "role_super_admin",
        role: "super_admin",
        permissions: ["customer.read", "customer.write", "lead.read", "lead.write", "projection.read", "projection.write", "order.read", "order.write", "payment.read", "payment.write", "user.manage", "role.manage", "report.view"],
        mustChangePassword: false,
      },
    });
  });

  it("owner hitting / lands on the management home", async () => {
    renderApp(["/"]);
    expect(await screen.findByText(/super admin hub/i, undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it("opening a management renders the dashboard shell", async () => {
    renderApp([`/managements/${DEFAULT_MANAGEMENT_ID}/dashboard`]);
    expect(await screen.findByText(/executive overview/i, undefined, { timeout: 5000 })).toBeInTheDocument();
  });
});
