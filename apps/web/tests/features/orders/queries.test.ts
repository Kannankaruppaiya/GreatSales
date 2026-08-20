import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import * as api from "../../../src/lib/api";
import { orderKeys } from "../../../src/features/orders/queries";

describe("orders queries", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("list requests /orders with cursor + limit 50", async () => {
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ items: [], nextCursor: null });
    // exercise the queryFn shape the hook builds:
    const { ordersQueryFn } = await import("../../../src/features/orders/queries");
    await ordersQueryFn({ search: "anand" }, undefined);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/orders?"));
    expect(spy.mock.calls[0][0]).toContain("limit=50");
    expect(spy.mock.calls[0][0]).toContain("search=anand");
  });

  it("list forwards status/customerId/ownerId filters as raw query params", async () => {
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ items: [], nextCursor: null });
    const { ordersQueryFn } = await import("../../../src/features/orders/queries");
    await ordersQueryFn(
      { status: "Acknowledged", customerId: "cust_1", ownerId: "u_1" },
      undefined,
    );
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("status=Acknowledged");
    expect(url).toContain("customerId=cust_1");
    expect(url).toContain("ownerId=u_1");
  });

  it("exposes a stable query key", () => {
    expect(orderKeys.list({ search: "x" })).toEqual(["orders", { search: "x" }]);
  });

  it("create invalidates the orders list", async () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, "invalidateQueries");
    const { onOrderMutationSuccess } = await import("../../../src/features/orders/queries");
    onOrderMutationSuccess(qc);
    expect(inv).toHaveBeenCalledWith({ queryKey: ["orders"] });
  });
});
