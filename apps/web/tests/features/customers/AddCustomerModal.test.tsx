import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddCustomerModal } from "@/features/customers/AddCustomerModal";
import * as api from "@/lib/api";

const salespeople = [{ id: "u_sales1", name: "Test Sales" }];

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AddCustomerModal open onClose={() => {}} salespeople={salespeople} />
    </QueryClientProvider>,
  );
}

describe("AddCustomerModal enum payloads", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("submits the raw DB enum value for the selected payment-terms label, not the label itself", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "cust_1" });
    renderModal();

    await userEvent.type(
      screen.getByPlaceholderText(/anand automotive/i),
      "Regression Test Co",
    );

    // Default is already "30 Days Credit" / "Green Zone" (raw Credit30 /
    // GreenZone) — explicitly change both away from the default so this test
    // exercises the label→raw mapping mechanism, not just the default.
    const paymentTermsSelect = screen.getByDisplayValue("30 Days Credit");
    await userEvent.selectOptions(paymentTermsSelect, "45 Days Credit");

    const payZoneSelect = screen.getByDisplayValue("Green Zone");
    await userEvent.selectOptions(payZoneSelect, "Yellow Zone");

    await userEvent.click(screen.getByRole("button", { name: /create customer/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    // The API's CustomerCreateSchema only accepts raw DB enum strings
    // (PaymentTermsSchema / PayZoneSchema in packages/shared/src/enums.ts) —
    // sending the display label ("45 Days Credit") would 400.
    expect(body.paymentTerms).toBe("Credit45");
    expect(body.payZone).toBe("YellowZone");
  });

  it("defaults to a valid raw payment-terms/pay-zone value so an unmodified Create doesn't 400", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "cust_2" });
    renderModal();

    await userEvent.type(
      screen.getByPlaceholderText(/anand automotive/i),
      "Unmodified Defaults Co",
    );
    await userEvent.click(screen.getByRole("button", { name: /create customer/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.paymentTerms).toBe("Credit30");
    expect(body.payZone).toBe("GreenZone");
  });
});
