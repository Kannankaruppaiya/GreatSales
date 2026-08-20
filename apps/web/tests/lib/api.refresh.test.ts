import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiFetch, setTokenGetter, setRefreshHandler } from "../../src/lib/api";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch token refresh", () => {
  beforeEach(() => {
    setTokenGetter(() => "expired");
    vi.restoreAllMocks();
  });

  it("refreshes once on 401 then retries the original request", async () => {
    const refresh = vi.fn().mockResolvedValue("fresh");
    setRefreshHandler(refresh);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const out = await apiFetch<{ ok: boolean }>("/things");

    expect(out).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    // retry carried the fresh bearer
    const retryHeaders = new Headers(fetchMock.mock.calls[1][1]!.headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer fresh");
  });

  it("throws 401 and does not retry when refresh fails", async () => {
    setRefreshHandler(vi.fn().mockResolvedValue(null));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(401, { message: "expired" }));

    await expect(apiFetch("/things")).rejects.toMatchObject({ status: 401 });
  });

  it("shares a single refresh across concurrent 401s", async () => {
    const refresh = vi.fn().mockImplementation(
      () => new Promise<string>((r) => setTimeout(() => r("fresh"), 10)),
    );
    setRefreshHandler(refresh);
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      const auth = new Headers(init?.headers).get("Authorization");
      return Promise.resolve(
        auth === "Bearer fresh" ? jsonResponse(200, { ok: true }) : jsonResponse(401, { message: "expired" }),
      );
    });

    await Promise.all([apiFetch("/a"), apiFetch("/b"), apiFetch("/c")]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
