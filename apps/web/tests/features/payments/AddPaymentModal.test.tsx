import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddPaymentModal } from "@/features/payments/AddPaymentModal";
import * as api from "@/lib/api";

const salespeople = [{ id: "u_sales1", name: "Test Sales" }];

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AddPaymentModal open onClose={() => {}} salespeople={salespeople} />
    </QueryClientProvider>,
  );
}

describe("AddPaymentModal enum payloads", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("submits the raw DB enum value for the selected pay-zone label, not the label itself", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "pmt_1" });
    renderModal();

    // Amount is the only required field — it's the first of two "0"-placeholder
    // number inputs (Invoice Amount, then Received).
    const amountInputs = screen.getAllByPlaceholderText("0");
    await userEvent.type(amountInputs[0], "1000");

    // Default is already "Green Zone" (raw GreenZone) — explicitly change it
    // away from the default so this test exercises the label→raw mapping
    // mechanism, not just the default.
    const payZoneSelect = screen.getByDisplayValue("Green Zone");
    await userEvent.selectOptions(payZoneSelect, "Yellow Zone");

    await userEvent.click(screen.getByRole("button", { name: /save invoice/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    // PaymentCreateSchema only accepts raw DB enum strings (PayZoneSchema in
    // packages/shared/src/enums.ts) — sending the display label
    // ("Yellow Zone") would 400.
    expect(body.payZone).toBe("YellowZone");
  });

  it("defaults to a valid raw pay-zone value so an unmodified Save doesn't 400", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "pmt_2" });
    renderModal();

    const amountInputs = screen.getAllByPlaceholderText("0");
    await userEvent.type(amountInputs[0], "500");
    await userEvent.click(screen.getByRole("button", { name: /save invoice/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.payZone).toBe("GreenZone");
  });
});
