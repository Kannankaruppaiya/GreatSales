import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import * as api from "../../../src/lib/api";
import { leadKeys } from "../../../src/features/leads/queries";

describe("leads queries", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("list requests /leads with cursor + limit 50", async () => {
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ items: [], nextCursor: null });
    // exercise the queryFn shape the hook builds:
    const { leadsQueryFn } = await import("../../../src/features/leads/queries");
    await leadsQueryFn({ search: "acme" }, undefined);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/leads?"));
    expect(spy.mock.calls[0][0]).toContain("limit=50");
    expect(spy.mock.calls[0][0]).toContain("search=acme");
  });

  it("exposes a stable query key", () => {
    expect(leadKeys.list({ ownerId: "u_1" })).toEqual(["leads", { ownerId: "u_1" }]);
  });

  it("create invalidates the leads list", async () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, "invalidateQueries");
    const { onLeadMutationSuccess } = await import("../../../src/features/leads/queries");
    onLeadMutationSuccess(qc);
    expect(inv).toHaveBeenCalledWith({ queryKey: ["leads"] });
  });
});
