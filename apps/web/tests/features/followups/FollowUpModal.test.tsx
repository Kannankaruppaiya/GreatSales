import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FollowUpModal } from "@/features/followups/FollowUpModal";
import * as api from "@/lib/api";

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FollowUpModal open onClose={() => {}} />
    </QueryClientProvider>,
  );
}

describe("FollowUpModal enum payloads", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("submits the raw DB enum value for the selected entity type", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "fu_1" });
    renderModal();

    await userEvent.type(screen.getByPlaceholderText(/cust_1, lead_2/i), "lead_42");

    // Default is already the first raw value ("Customer") — explicitly
    // change it so this test exercises the select→payload path, not just
    // the default.
    const entityTypeSelect = screen.getByDisplayValue("Customer");
    await userEvent.selectOptions(entityTypeSelect, "Lead");

    await userEvent.click(screen.getByRole("button", { name: /create follow-up/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    // The API's FollowUpCreateSchema only accepts raw DB enum strings
    // (EntityTypeSchema in packages/shared/src/enums.ts) — sending anything
    // else would 400. Here the raw value and the display text are the same
    // string, so this also guards against a future label/value split.
    expect(body.entityType).toBe("Lead");
    expect(body.entityId).toBe("lead_42");
  });

  it("defaults to a valid raw entity-type value so an unmodified Create doesn't 400", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ id: "fu_2" });
    renderModal();

    await userEvent.type(screen.getByPlaceholderText(/cust_1, lead_2/i), "cust_9");
    await userEvent.click(screen.getByRole("button", { name: /create follow-up/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.entityType).toBe("Customer");
  });
});
