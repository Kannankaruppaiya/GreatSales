import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LeadDetailModal } from "@/features/leads/LeadDetailModal";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import type { LeadRow } from "@/features/leads/types";
import { permissionsFor } from "../../helpers/authFixtures";

function makeLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead_1",
    customerName: "Acme Co",
    division: "LUB",
    tier: "Platinum",
    type: "New",
    salespersonId: "u_sales1",
    salespersonName: "Test Sales",
    stage: "NewEnquiries",
    leadStatus: null,
    industryId: null,
    industryName: null,
    subIndustry: null,
    area: "Ambattur",
    address: null,
    contactName: "Mr. Raja",
    phone: "+91 98400 12345",
    whatsapp: null,
    sameAsMobile: true,
    email: null,
    nextFollowUp: null,
    expClose: null,
    stageUpdatedAt: null,
    products: [],
    totalValue: 5000,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function setRole(role: "admin" | "mgmt") {
  useAuth.setState({
    accessToken: "test",
    user: {
      id: "u_1",
      tenantId: "tenant_acme",
      name: "Test User",
      email: "test@acme.test",
      username: "test",
      roleId: role === "admin" ? "role_admin" : "role_mgmt",
      role,
      permissions: permissionsFor(role),
      mustChangePassword: false,
    },
  });
}

function renderModal(lead: LeadRow) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LeadDetailModal open onClose={() => {}} lead={lead} />
    </QueryClientProvider>,
  );
}

describe("LeadDetailModal Kanban stage change", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setRole("admin");
  });

  it("PATCHes the raw stage value for a stage whose label differs from its raw value", async () => {
    // "NewEnquiries" -> "NegotiationOralConfirmation": the drop target's
    // label ("Negotiation / Oral Confirmation") differs from its raw value,
    // so this actually discriminates a label-vs-raw regression the same way
    // a Kanban card drop onto that column would (both paths call
    // useUpdateLead().mutate({ id, patch: { stage } }) with the raw value).
    const lead = makeLead({ stage: "NewEnquiries" });
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue({ ...lead, stage: "NegotiationOralConfirmation" });
    renderModal(lead);

    const stageSelect = screen.getByDisplayValue("New Enquiries");
    await userEvent.selectOptions(stageSelect, "Negotiation / Oral Confirmation");

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      const patchCall = spy.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall).toBeTruthy();
    });
    const patchCall = spy.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(patchCall[0]).toContain("/leads/lead_1");
    const body = JSON.parse(patchCall[1]!.body as string);
    // LeadUpdateSchema only accepts raw DB enum strings (DealStageSchema in
    // packages/shared/src/enums.ts) — sending the display label
    // ("Negotiation / Oral Confirmation") would 400.
    expect(body.stage).toBe("NegotiationOralConfirmation");
    // products is never part of LeadUpdate this cycle (create-only).
    expect(body.products).toBeUndefined();
  });

  it("does not PATCH when no field changed", async () => {
    const lead = makeLead({ stage: "NewEnquiries" });
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue(lead);
    renderModal(lead);

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    // Asserts no WRITE, not no request: the modal also reads its remark
    // timeline, which is a GET. The original `not.toHaveBeenCalled()` was a
    // proxy for "did not save" that stopped meaning that once the modal
    // legitimately fetched something.
    const writes = spy.mock.calls.filter(
      ([, init]) => init?.method && init.method !== "GET",
    );
    expect(writes).toHaveLength(0);
  });
});
