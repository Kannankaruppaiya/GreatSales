import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useAuth } from "@/store/auth";

/**
 * A salesperson signing in on web must establish a session like any other
 * role. Server-side ownership scoping — not a client-side block — is what
 * limits what they can reach.
 */
describe("useAuth.login for the sales role", () => {
  beforeEach(() => {
    useAuth.setState({ accessToken: null, refreshToken: null, user: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            accessToken: "at",
            refreshToken: "rt",
            user: {
              id: "u2",
              tenantId: "tenant_acme",
              name: "Megala",
              email: "megala@acme.test",
              username: "megala",
              roleId: "role_sales",
              role: "sales",
            },
          }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("establishes a session instead of throwing", async () => {
    await expect(
      useAuth.getState().login("tenant_acme", "megala@acme.test", "pw"),
    ).resolves.toBeUndefined();

    expect(useAuth.getState().accessToken).toBe("at");
    expect(useAuth.getState().user?.role).toBe("sales");
  });
});
