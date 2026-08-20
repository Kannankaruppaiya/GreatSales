import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import * as api from "../../../src/lib/api";
import { followUpKeys } from "../../../src/features/followups/queries";

describe("followups queries", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("list requests /followups with cursor + limit 50", async () => {
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ items: [], nextCursor: null });
    const { followUpsQueryFn } = await import("../../../src/features/followups/queries");
    await followUpsQueryFn({ search: "oil" }, undefined);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/followups?"));
    expect(spy.mock.calls[0][0]).toContain("limit=50");
    expect(spy.mock.calls[0][0]).toContain("search=oil");
  });

  it("passes the boolean `done` filter through buildQuery as a string", async () => {
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ items: [], nextCursor: null });
    const { followUpsQueryFn } = await import("../../../src/features/followups/queries");
    await followUpsQueryFn({ ownerId: "u_1", done: false }, undefined);
    // buildQuery drops falsy-but-defined params only when they are "" — a
    // boolean `false` must be turned into the string "false" before it
    // reaches buildQuery, or the filter silently disappears from the URL.
    expect(spy.mock.calls[0][0]).toContain("done=false");
    expect(spy.mock.calls[0][0]).toContain("ownerId=u_1");
  });

  it("exposes a stable query key", () => {
    expect(followUpKeys.list({ search: "x" })).toEqual(["followups", { search: "x" }]);
  });

  it("create invalidates the followups list", async () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, "invalidateQueries");
    const { onFollowUpMutationSuccess } = await import("../../../src/features/followups/queries");
    onFollowUpMutationSuccess(qc);
    expect(inv).toHaveBeenCalledWith({ queryKey: ["followups"] });
  });
});
