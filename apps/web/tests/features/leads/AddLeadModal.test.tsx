import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddLeadModal } from "@/features/leads/AddLeadModal";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import type { LeadFkOption } from "@/features/leads/AddLeadModal";
import { permissionsFor } from "../../helpers/authFixtures";

const salespeople = [{ id: "u_sales1", name: "Test Sales" }];

function setRole(role: "admin" | "mgmt" | "sales", userId = "u_1") {
  useAuth.setState({
    accessToken: "test",
    user: {
      id: userId,
      tenantId: "tenant_acme",
      name: "Test User",
      email: "test@acme.test",
      username: "test",
      roleId: role === "admin" ? "role_admin" : role === "sales" ? "role_sales" : "role_mgmt",
      role,
      permissions: permissionsFor(role),
      mustChangePassword: false,
    },
  });
}

/** GET requests (the self-fetched product catalog) return an empty page;
 * POST requests (the create call under test) return a stub LeadRow id. */
function mockApiFetch() {
  return vi.spyOn(api, "apiFetch").mockImplementation((_path, init) => {
    if (init?.method === "POST") return Promise.resolve({ id: "lead_1" });
    return Promise.resolve({ items: [], nextCursor: null });
  });
}

function renderModal(options: LeadFkOption[] = salespeople) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AddLeadModal open onClose={() => {}} salespeople={options} industries={[]} />
    </QueryClientProvider>,
  );
}

describe("AddLeadModal enum payloads", () => {
  beforeEach(() => vi.restoreAllMocks());
  // The auth store is a module-level singleton — reset it after every test
  // so setRole("sales", ...) below can't leak into a test that never calls it.
  afterEach(() => useAuth.setState({ accessToken: null, user: null }));

  it("keeps Save enabled for sales even with an EMPTY salesperson options list", async () => {
    // Same bug shape as AddCustomerModal: a newly-onboarded salesperson has
    // zero leads yet, so `salespeople` (derived from loaded rows in
    // LeadsPage) is empty. The API always forces salespersonId = user.userId
    // for a sales caller (leads.service.ts `create`), so the client doesn't
    // need a picker for `sales`. A populated-options test would not catch
    // the empty-list bug at all.
    setRole("sales", "u_sales_self");
    const spy = mockApiFetch();
    renderModal([]);

    expect(screen.queryByText(/no salespersons yet/i)).toBeNull();
    await userEvent.type(
      screen.getByPlaceholderText(/acme precision tools/i),
      "Sales Self-Serve Co",
    );
    const saveBtn = screen.getByRole("button", { name: /create lead/i });
    expect(saveBtn).toBeEnabled();

    await userEvent.click(saveBtn);
    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.salespersonId).toBe("u_sales_self");
  });

  it("submits the raw DB enum value for the selected pipeline-stage label, not the label itself", async () => {
    const spy = mockApiFetch();
    renderModal();

    await userEvent.type(
      screen.getByPlaceholderText(/acme precision tools/i),
      "Regression Test Co",
    );
    await userEvent.selectOptions(screen.getByLabelText(/assigned salesperson/i), "Test Sales");

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
    await userEvent.selectOptions(screen.getByLabelText(/assigned salesperson/i), "Test Sales");
    await userEvent.click(screen.getByRole("button", { name: /create lead/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.stage).toBe("NewEnquiries");
    // totalValue must never be sent — it's server-computed from products.
    expect(body.totalValue).toBeUndefined();
  });

  it("blocks Create for admin/mgmt until a salesperson is explicitly chosen — no falling back to whoever sorts first", async () => {
    // The bug this guards: selectedSalespersonId used to fall back to
    // salespersonOptions[0]?.id, so an admin who never touched the field
    // silently created a lead owned by whichever name sorted first
    // alphabetically — active or not. The field is marked required; it must
    // actually behave that way.
    const spy = mockApiFetch();
    renderModal();

    await userEvent.type(
      screen.getByPlaceholderText(/acme precision tools/i),
      "No Owner Chosen Co",
    );
    expect(screen.getByRole("button", { name: /create lead/i })).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText(/assigned salesperson/i), "Test Sales");
    expect(screen.getByRole("button", { name: /create lead/i })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /create lead/i }));
    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.salespersonId).toBe("u_sales1");
  });
});
