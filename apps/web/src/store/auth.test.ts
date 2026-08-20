import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api", () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  setTokenGetter: vi.fn(),
}));

import { useAuth, SalesWebLoginError } from "./auth";

const makeResponse = (role: string) => ({
  accessToken: "acc",
  refreshToken: "ref",
  user: {
    id: "u1",
    tenantId: "tenant_acme",
    name: "Acme Admin",
    email: "admin@acme.test",
    username: "admin_acme",
    roleId: "role_admin_acme",
    role,
  },
});

beforeEach(() => {
  apiFetch.mockReset();
  useAuth.getState().logout();
});
afterEach(() => localStorage.clear());

describe("useAuth", () => {
  it("stores tokens + user on login and derives role/isOwner", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await useAuth.getState().login("tenant_acme", "admin@acme.test", "Passw0rd!");

    const s = useAuth.getState();
    expect(s.accessToken).toBe("acc");
    expect(s.refreshToken).toBe("ref");
    expect(s.user?.email).toBe("admin@acme.test");
    expect(apiFetch).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant_acme",
        email: "admin@acme.test",
        password: "Passw0rd!",
      }),
    });
  });

  it("rejects a sales-role login on the web and leaves the store cleared", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("sales"));
    await expect(
      useAuth.getState().login("tenant_acme", "sales1@acme.test", "Passw0rd!"),
    ).rejects.toBeInstanceOf(SalesWebLoginError);

    const s = useAuth.getState();
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
  });

  it("logout clears the session", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await useAuth.getState().login("tenant_acme", "admin@acme.test", "Passw0rd!");
    useAuth.getState().logout();
    const s = useAuth.getState();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.user).toBeNull();
  });
});
