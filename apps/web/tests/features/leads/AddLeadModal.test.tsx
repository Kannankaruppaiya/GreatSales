import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddLeadModal } from "@/features/leads/AddLeadModal";
import * as api from "@/lib/api";

const salespeople = [{ id: "u_sales1", name: "Test Sales" }];

/** GET requests (the self-fetched product catalog) return an empty page;
 * POST requests (the create call under test) return a stub LeadRow id. */
function mockApiFetch() {
  return vi.spyOn(api, "apiFetch").mockImplementation((_path, init) => {
    if (init?.method === "POST") return Promise.resolve({ id: "lead_1" });
    return Promise.resolve({ items: [], nextCursor: null });
  });
}

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AddLeadModal open onClose={() => {}} salespeople={salespeople} industries={[]} />
    </QueryClientProvider>,
  );
}

describe("AddLeadModal enum payloads", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("submits the raw DB enum value for the selected pipeline-stage label, not the label itself", async () => {
    const spy = mockApiFetch();
    renderModal();

    await userEvent.type(
      screen.getByPlaceholderText(/acme precision tools/i),
      "Regression Test Co",
    );

    // Default is already "New Enquiries" (raw NewEnquiries, where label ==
    // raw) — explicitly change to "Negotiation / Oral Confirmation" (raw
    // NegotiationOralConfirmation), whose label DIFFERS from its raw value,
    // so this actually discriminates a label-vs-raw regression.
    const stageSelect = screen.getByDisplayValue("New Enquiries");
    await userEvent.selectOptions(stageSelect, "Negotiation / Oral Confirmation");

    await userEvent.click(screen.getByRole("button", { name: /create lead/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    // LeadCreateSchema only accepts raw DB enum strings (DealStageSchema in
    // packages/shared/src/enums.ts) — sending the display label
    // ("Negotiation / Oral Confirmation") would 400.
    expect(body.stage).toBe("NegotiationOralConfirmation");
  });

  it("defaults to a valid raw pipeline-stage value so an unmodified Create doesn't 400", async () => {
    const spy = mockApiFetch();
    renderModal();

    await userEvent.type(
      screen.getByPlaceholderText(/acme precision tools/i),
      "Unmodified Defaults Co",
    );
    await userEvent.click(screen.getByRole("button", { name: /create lead/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.stage).toBe("NewEnquiries");
    // totalValue must never be sent — it's server-computed from products.
    expect(body.totalValue).toBeUndefined();
  });
});
