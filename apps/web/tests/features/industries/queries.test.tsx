import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";
import * as api from "../../../src/lib/api";
import {
  useIndustries,
  industryKeys,
} from "../../../src/features/industries/queries";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe("industries queries", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("exposes a stable query key", () => {
    expect(industryKeys.all).toEqual(["industries"]);
  });

  it("fetches GET /industries when enabled", async () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue([
      { id: "ind_pharma", name: "Pharmaceutical", subIndustries: ["API"] },
    ]);

    const { result } = renderHook(() => useIndustries(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith("/industries");
    expect(result.current.data).toEqual([
      { id: "ind_pharma", name: "Pharmaceutical", subIndustries: ["API"] },
    ]);
  });

  it("does not fetch while disabled (picker closed)", () => {
    const spy = vi.spyOn(api, "apiFetch").mockResolvedValue([]);
    renderHook(() => useIndustries({ enabled: false }), { wrapper: wrapper() });
    expect(spy).not.toHaveBeenCalled();
  });
});
