import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import * as api from "../../../src/lib/api";
import {
  invalidateAdminFamilies,
  roleKeys,
  teamKeys,
  userKeys,
  userTotal,
  usersQueryFn,
} from "../../../src/features/users/queries";

describe("users query serialisation", () => {
  beforeEach(() => vi.restoreAllMocks());

  const spyFetch = () =>
    vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ items: [], nextCursor: null, total: 0 });

  it("serialises every list parameter into the query string", async () => {
    const spy = spyFetch();
    await usersQueryFn(
      {
        search: "ramesh",
        roleId: "role_sales",
        teamId: "team_1",
        status: "inactive",
        sort: "email",
        dir: "desc",
        includeDeleted: true,
      },
      undefined,
    );

    const url = spy.mock.calls[0][0];
    expect(url).toContain("search=ramesh");
    expect(url).toContain("roleId=role_sales");
    expect(url).toContain("teamId=team_1");
    expect(url).toContain("status=inactive");
    expect(url).toContain("sort=email");
    expect(url).toContain("dir=desc");
    expect(url).toContain("includeDeleted=true");
  });

  it("sends includeDeleted as the STRING the server's enum expects", async () => {
    // The server rejects any other spelling rather than coercing it, which is
    // exactly why `?active=false` silently returning ACTIVE users cannot
    // happen again.
    const spy = spyFetch();
    await usersQueryFn({ includeDeleted: false }, undefined);
    expect(spy.mock.calls[0][0]).toContain("includeDeleted=false");
  });

  it("omits parameters that were not set, rather than sending 'undefined'", async () => {
    const spy = spyFetch();
    await usersQueryFn({}, undefined);
    const url = spy.mock.calls[0][0];
    expect(url).not.toContain("undefined");
    expect(url).not.toContain("roleId=");
    expect(url).not.toContain("search=");
  });

  it("passes the cursor through for the next page", async () => {
    const spy = spyFetch();
    await usersQueryFn({}, "cursor_abc");
    expect(spy.mock.calls[0][0]).toContain("cursor=cursor_abc");
  });

  it("exposes stable query keys", () => {
    expect(userKeys.list({ search: "x" })).toEqual(["users", { search: "x" }]);
    expect(roleKeys.list()).toEqual(["roles"]);
    expect(teamKeys.members("t1")).toEqual(["teams", "t1", "members"]);
  });
});

describe("userTotal", () => {
  it("reads the SERVER's total, not the number of loaded rows", () => {
    // The defect this replaces: the header counted loaded pages, so it
    // under-reported the moment the list paginated.
    const data = {
      pages: [
        {
          items: [{ id: "a" }, { id: "b" }, { id: "c" }],
          nextCursor: "x",
          total: 47,
        },
      ],
    } as never;
    expect(userTotal(data)).toBe(47);
  });

  it("is zero before anything has loaded", () => {
    expect(userTotal(undefined)).toBe(0);
  });
});

describe("cross-invalidation", () => {
  it("invalidates users, roles AND teams on any administrative change", async () => {
    // These resources are not independent: a role change moves a role's
    // userCount, and a team delete detaches members. Invalidating only one
    // family would leave the other tabs showing stale numbers immediately
    // after the operator changed them.
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, "invalidateQueries");

    await invalidateAdminFamilies(qc);

    expect(inv).toHaveBeenCalledWith({ queryKey: ["users"] });
    expect(inv).toHaveBeenCalledWith({ queryKey: ["roles"] });
    expect(inv).toHaveBeenCalledWith({ queryKey: ["teams"] });
  });
});
