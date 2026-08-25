import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  setTokenGetter: vi.fn(),
  setRefreshHandler: vi.fn(),
}));

import { useAuth } from "@/store/auth";

const makeResponse = (role: string) => ({
  accessToken: "acc",
  expiresIn: 900,
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

const signIn = (email = "admin@acme.test") =>
  useAuth.getState().login("tenant_acme", email, "Passw0rd!");

beforeEach(() => {
  apiFetch.mockReset();
  useAuth.setState({
    accessToken: null,
    user: null,
    lastTenantId: null,
    status: "unknown",
  });
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe("useAuth — login", () => {
  it("stores the access token and profile", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await signIn();

    const s = useAuth.getState();
    expect(s.accessToken).toBe("acc");
    expect(s.user?.email).toBe("admin@acme.test");
    expect(s.status).toBe("ready");
  });

  it("asks for cookie delivery, so no refresh token reaches JavaScript", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await signIn();

    expect(apiFetch).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant_acme",
        email: "admin@acme.test",
        password: "Passw0rd!",
        tokenDelivery: "cookie",
      }),
    });
  });

  it("keeps no refresh token in state at all", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await signIn();
    expect(useAuth.getState()).not.toHaveProperty("refreshToken");
  });

  it("establishes a session for a sales-role login on the web", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("sales"));
    await expect(signIn("sales1@acme.test")).resolves.toBeUndefined();
    expect(useAuth.getState().user?.role).toBe("sales");
  });

  it("propagates a failure instead of half-establishing a session", async () => {
    apiFetch.mockRejectedValueOnce(new Error("bad creds"));
    await expect(signIn()).rejects.toThrow("bad creds");

    const s = useAuth.getState();
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
  });
});

describe("useAuth — what reaches storage", () => {
  it("persists the workspace id but never the token or profile", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await signIn();

    const raw = localStorage.getItem("greatsales_auth") ?? "";
    expect(raw).toContain("tenant_acme"); // the convenience value
    expect(raw).not.toContain("acc"); // the access token
    expect(raw).not.toContain("admin@acme.test"); // the profile
  });

  it("remembers the workspace for the next sign-in", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await signIn();
    expect(useAuth.getState().lastTenantId).toBe("tenant_acme");
  });
});

describe("useAuth — logout", () => {
  it("revokes the session server-side, not just locally", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await signIn();

    apiFetch.mockResolvedValueOnce({ revoked: 1 });
    await useAuth.getState().logout();

    expect(apiFetch).toHaveBeenLastCalledWith("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ allSessions: false }),
    });
    const s = useAuth.getState();
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
  });

  it("can revoke every session when asked", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await signIn();

    apiFetch.mockResolvedValueOnce({ revoked: 3 });
    await useAuth.getState().logout(true);

    expect(apiFetch).toHaveBeenLastCalledWith("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ allSessions: true }),
    });
  });

  it("still signs the user out locally when the server call fails", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await signIn();

    apiFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(useAuth.getState().logout()).resolves.toBeUndefined();
    expect(useAuth.getState().accessToken).toBeNull();
  });
});

describe("useAuth — bootstrap", () => {
  it("restores a session from the refresh cookie on a cold load", async () => {
    apiFetch
      .mockResolvedValueOnce({ accessToken: "fresh", expiresIn: 900 }) // refresh
      .mockResolvedValueOnce(makeResponse("admin").user); // me

    await useAuth.getState().bootstrap();

    const s = useAuth.getState();
    expect(s.accessToken).toBe("fresh");
    expect(s.user?.email).toBe("admin@acme.test");
    expect(s.status).toBe("ready");
  });

  it("settles as signed out when there is no usable cookie", async () => {
    apiFetch.mockRejectedValueOnce(new Error("401"));

    await useAuth.getState().bootstrap();

    const s = useAuth.getState();
    expect(s.accessToken).toBeNull();
    expect(s.status).toBe("ready"); // resolved, not stuck on "unknown"
  });

  it("does not re-authenticate a tab that already holds a token", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await signIn();
    apiFetch.mockClear();

    await useAuth.getState().bootstrap();

    expect(apiFetch).not.toHaveBeenCalled();
    expect(useAuth.getState().accessToken).toBe("acc");
  });
});
