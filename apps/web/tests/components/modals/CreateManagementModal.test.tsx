import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CreateManagementModal } from "@/components/modals/CreateManagementModal";
import { useManagementStore } from "@/store/managementStore";
import { DEFAULT_MANAGEMENT_ID } from "@/store/ui";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

describe("CreateManagementModal", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useManagementStore.setState({
      managements: [
        {
          id: DEFAULT_MANAGEMENT_ID,
          name: "Default",
          initials: "DF",
          industry: "x",
          currency: "INR (₹)",
          createdAt: "2026-08-19",
        },
      ],
      datasets: {},
    });
  });

  it("validates the required name", async () => {
    render(
      <MemoryRouter>
        <CreateManagementModal open onClose={() => {}} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /create management/i }));
    expect(screen.getByText(/enter a company name/i)).toBeInTheDocument();
    expect(useManagementStore.getState().managements).toHaveLength(1);
  });

  it("creates a management and navigates into it", async () => {
    render(
      <MemoryRouter>
        <CreateManagementModal open onClose={() => {}} />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/company name/i), "Nova Foods");
    await userEvent.click(screen.getByRole("button", { name: /create management/i }));
    const created = useManagementStore.getState().managements.find((m) => m.name === "Nova Foods");
    expect(created).toBeTruthy();
    expect(navigateMock).toHaveBeenCalledWith(`/managements/${created!.id}/dashboard`);
  });
});
