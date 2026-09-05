import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ManagementSwitcher } from "@/features/management/ManagementSwitcher";
import { useUi } from "@/store/ui";
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
    status: "Active",
    region: "in",
    industry: "Pharma",
    currency: "INR (₹)",
    userCount: 3,
    salesThisMonth: 0,
    createdAt: "2026-08-19T00:00:00.000Z",
  },
];

function wrap(children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function asOwner() {
  usePlatformAuth.setState({
    accessToken: "platform",
    platformUser: { id: "pu", name: "Owner", email: "o@x.io", role: "SuperAdmin" },
  });
}

describe("ManagementSwitcher", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useUi.setState({ activeManagementId: "tenant_gs" });
    usePlatformAuth.setState({ accessToken: null, platformUser: null });
    vi.spyOn(platformApi, "platformFetch").mockResolvedValue(MANAGEMENTS);
  });

  it("hides when there is no platform (owner) session", () => {
    const { container } = render(wrap(<ManagementSwitcher />));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current management and lists the others to switch to", async () => {
    asOwner();
    render(wrap(<ManagementSwitcher />));

    expect(
      await screen.findByText("GreatSales Industrial Corp"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /switch management/i }),
    );

    // The other management is offered; the current one is not repeated.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /acme traders/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /back to all managements/i }),
    ).toBeInTheDocument();
  });
});
