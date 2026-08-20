import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import * as api from "../../../src/lib/api";
import { userKeys } from "../../../src/features/users/queries";

describe("users queries", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("list requests /users with cursor + limit 50", async () => {
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ items: [], nextCursor: null });
    // exercise the queryFn shape the hook builds:
    const { usersQueryFn } = await import("../../../src/features/users/queries");
    await usersQueryFn({ search: "ramesh" }, undefined);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/users?"));
    expect(spy.mock.calls[0][0]).toContain("limit=50");
    expect(spy.mock.calls[0][0]).toContain("search=ramesh");
  });

  it("exposes a stable query key", () => {
    expect(userKeys.list({ search: "x" })).toEqual(["users", { search: "x" }]);
  });

  it("create invalidates the users list", async () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, "invalidateQueries");
    const { onUserMutationSuccess } = await import("../../../src/features/users/queries");
    onUserMutationSuccess(qc);
    expect(inv).toHaveBeenCalledWith({ queryKey: ["users"] });
  });
});
