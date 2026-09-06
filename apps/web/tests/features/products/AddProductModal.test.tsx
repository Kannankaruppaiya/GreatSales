import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddProductModal } from "@/features/products/AddProductModal";
import * as api from "@/lib/api";
import type { PrincipalRow } from "@/features/products/types";

const mockPrincipals: PrincipalRow[] = [
  {
    id: "pr_motul",
    name: "MOTUL",
    productCount: 5,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "pr_castrol",
    name: "CASTROL",
    productCount: 12,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

function renderModal({
  open = true,
  onClose = vi.fn(),
  principals = mockPrincipals,
  onOpenAddPrincipal = vi.fn(),
}: {
  open?: boolean;
  onClose?: () => void;
  principals?: PrincipalRow[];
  onOpenAddPrincipal?: () => void;
} = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onClose,
    onOpenAddPrincipal,
    ...render(
      <QueryClientProvider client={qc}>
        <AddProductModal
          open={open}
          onClose={onClose}
          principals={principals}
          onOpenAddPrincipal={onOpenAddPrincipal}
        />
      </QueryClientProvider>,
    ),
  };
}

describe("AddProductModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders with appropriate headings, labels, and accessible attributes", () => {
    renderModal();

    expect(screen.getByRole("heading", { name: /add catalog product/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /principal brand/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/product name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/product sku \/ code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/division/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/unit of measure/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/default benchmark price/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /add product/i });
    expect(submitBtn).toBeDisabled();
  });

  it("handles auto-suggest SKU and distinguishes auto-generated vs manual entry", async () => {
    renderModal();
    const user = userEvent.setup();

    const nameInput = screen.getByLabelText(/product name/i);
    await user.type(nameInput, "Hysol MB 50");

    const autoSuggestBtn = screen.getByRole("button", { name: /auto-suggest sku/i });
    await user.click(autoSuggestBtn);

    const skuInput = screen.getByLabelText(/product sku \/ code/i) as HTMLInputElement;
    expect(skuInput.value).toMatch(/^MOT-HYS-\d{3}$/);
    expect(screen.getByText(/auto-suggested/i)).toBeInTheDocument();

    // Now manually edit SKU
    await user.clear(skuInput);
    await user.type(skuInput, "CUSTOM-SKU-99");
    expect(skuInput).toHaveValue("CUSTOM-SKU-99");
    expect(screen.queryByText(/auto-suggested/i)).toBeNull();
  });

  it("submits the correct product payload on valid submission", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "prod_1" });
    const onClose = vi.fn();
    renderModal({ onClose });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/product name/i), "Castrol Magnatec 5W-30");
    await user.type(screen.getByLabelText(/product sku \/ code/i), "CAS-MAG-5W30");
    await user.type(screen.getByLabelText(/default benchmark price/i), "520.50");

    const submitBtn = screen.getByRole("button", { name: /add product/i });
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body).toEqual({
      name: "Castrol Magnatec 5W-30",
      principalId: "pr_motul",
      sku: "CAS-MAG-5W30",
      division: "LUB",
      unit: "Ltr",
      basePrice: 520.5,
      active: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("validates price is non-negative and displays error message", async () => {
    renderModal();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/product name/i), "Test Product");
    await user.type(screen.getByLabelText(/default benchmark price/i), "-50");

    const submitBtn = screen.getByRole("button", { name: /add product/i });
    await user.click(submitBtn);

    expect(screen.getByRole("alert")).toHaveTextContent(/valid non-negative selling price/i);
  });

  it("prompts for confirmation if user attempts to close with unsaved data", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const user = userEvent.setup();

    // Type into product name to make form dirty
    await user.type(screen.getByLabelText(/product name/i), "Unsaved Product Name");

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    // Should not immediately close, but show confirmation modal
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/discard unsaved product\?/i)).toBeInTheDocument();

    // Confirm discard
    const discardBtn = screen.getByRole("button", { name: /discard changes/i });
    await user.click(discardBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
