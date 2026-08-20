import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import * as api from "../../../src/lib/api";
import { productKeys } from "../../../src/features/products/queries";

describe("products queries", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("list requests /products with cursor + limit 50", async () => {
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ items: [], nextCursor: null });
    // exercise the queryFn shape the hook builds:
    const { productsQueryFn } = await import("../../../src/features/products/queries");
    await productsQueryFn({ search: "oil" }, undefined);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/products?"));
    expect(spy.mock.calls[0][0]).toContain("limit=50");
    expect(spy.mock.calls[0][0]).toContain("search=oil");
  });

  it("exposes a stable query key", () => {
    expect(productKeys.list({ search: "x" })).toEqual(["products", { search: "x" }]);
  });

  it("create invalidates the products list", async () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, "invalidateQueries");
    const { onProductMutationSuccess } = await import("../../../src/features/products/queries");
    onProductMutationSuccess(qc);
    expect(inv).toHaveBeenCalledWith({ queryKey: ["products"] });
  });
});
