import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import * as api from "../../../src/lib/api";
import { customerKeys } from "../../../src/features/customers/queries";

describe("customers queries", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("list requests /customers with cursor + limit 50", async () => {
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ items: [], nextCursor: null });
    // exercise the queryFn shape the hook builds:
    const { customersQueryFn } = await import("../../../src/features/customers/queries");
    await customersQueryFn({ search: "anand" }, undefined);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/customers?"));
    expect(spy.mock.calls[0][0]).toContain("limit=50");
    expect(spy.mock.calls[0][0]).toContain("search=anand");
  });

  it("exposes a stable query key", () => {
    expect(customerKeys.list({ search: "x" })).toEqual(["customers", { search: "x" }]);
  });

  it("create invalidates the customers list", async () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, "invalidateQueries");
    const { onCustomerMutationSuccess } = await import("../../../src/features/customers/queries");
    onCustomerMutationSuccess(qc);
    expect(inv).toHaveBeenCalledWith({ queryKey: ["customers"] });
  });
});
