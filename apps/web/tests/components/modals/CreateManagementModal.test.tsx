import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CreateManagementModal } from "@/features/management/CreateManagementModal";
import * as platformApi from "@/lib/platformApi";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function wrap(children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const CREATED = {
  management: {
    id: "tenant_nova",
    name: "Nova Foods",
    status: "Trial",
    region: "in",
    industry: "Food",
    currency: "INR (₹)",
    userCount: 1,
    salesThisMonth: 0,
    createdAt: "2026-08-29T00:00:00.000Z",
  },
  adminEmail: "admin@nova.test",
  tempPassword: "Temp-Pass-123Aa1!",
};

describe("CreateManagementModal", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.restoreAllMocks();
  });

  it("validates the required name before calling the API", async () => {
    const spy = vi.spyOn(platformApi, "platformFetch").mockResolvedValue(CREATED);
    render(wrap(<CreateManagementModal open onClose={() => {}} />));
    await userEvent.click(
      screen.getByRole("button", { name: /create management/i }),
    );
    expect(screen.getByText(/enter a company name/i)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("provisions a management and reveals the one-time admin password", async () => {
    vi.spyOn(platformApi, "platformFetch").mockResolvedValue(CREATED);
    render(wrap(<CreateManagementModal open onClose={() => {}} />));

    await userEvent.type(screen.getByLabelText(/company name/i), "Nova Foods");
    await userEvent.type(
      screen.getByLabelText(/first admin email/i),
      "admin@nova.test",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /create management/i }),
    );

    expect(await screen.findByText(/nova foods is ready/i)).toBeInTheDocument();
    expect(screen.getByText("admin@nova.test")).toBeInTheDocument();
    expect(screen.getByText("Temp-Pass-123Aa1!")).toBeInTheDocument();
  });
});
