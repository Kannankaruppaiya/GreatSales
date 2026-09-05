import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import ManagementHomePage from "@/features/management/ManagementHomePage";
import { usePlatformAuth } from "@/store/platformAuth";
import * as platformApi from "@/lib/platformApi";

const MANAGEMENTS = [
  {
    id: "tenant_gs",
    name: "GreatSales Industrial Corp",
    status: "Active",
    region: "in",
    industry: "Industrial",
    currency: "INR (₹)",
    userCount: 5,
    salesThisMonth: 0,
    createdAt: "2026-08-19T00:00:00.000Z",
  },
  {
    id: "tenant_acme",
    name: "Acme Traders",
    status: "Trial",
    region: "in",
    industry: "Pharma",
    currency: "INR (₹)",
    userCount: 3,
    salesThisMonth: 0,
    createdAt: "2026-08-19T00:00:00.000Z",
  },
];

const ASSUME_RESPONSE = {
  accessToken: "tenant-token",
  expiresIn: 900,
  user: {
    id: "user_admin_acme",
    tenantId: "tenant_acme",
    name: "Acme Admin",
    email: "admin@acme.test",
    username: "admin",
    roleId: "role_admin",
    role: "admin",
    permissions: [],
    mustChangePassword: false,
  },
};

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function wrap(children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/managements"]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ManagementHomePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePlatformAuth.setState({
      accessToken: "platform",
      platformUser: { id: "pu", name: "Owner", email: "o@x.io", role: "SuperAdmin" },
    });
    vi.spyOn(platformApi, "platformFetch").mockImplementation((path: string) => {
      if (path.includes("/assume")) return Promise.resolve(ASSUME_RESPONSE);
      return Promise.resolve(MANAGEMENTS);
    });
  });

  it("renders a card per management plus the create action", async () => {
    render(wrap(<ManagementHomePage />));
    expect(
      await screen.findByText("GreatSales Industrial Corp"),
    ).toBeInTheDocument();
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create management/i }),
    ).toBeInTheDocument();
  });

  it("opens a management into its dashboard", async () => {
    render(
      wrap(
        <>
          <ManagementHomePage />
          <LocationDisplay />
        </>,
      ),
    );

    const card = await screen.findByRole("button", { name: /acme traders/i });
    await userEvent.click(card);

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/managements/tenant_acme/dashboard",
      ),
    );
  });
});
