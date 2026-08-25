import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UsersPage from "@/features/users/UsersPage";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import { permissionsFor, type TestRole } from "../../helpers/authFixtures";

/**
 * The tab shell.
 *
 * Two things are being proved. First, that tab state lives in the URL, so a
 * refresh, Back, and a shared link all work — the previous page kept it in
 * component state and lost it on every reload. Second, that a tab the caller
 * cannot use is not offered at all, and a deep link to it falls back cleanly
 * rather than rendering an empty frame or flashing privileged content.
 */
function signIn(role: TestRole, overrides: Record<string, unknown> = {}) {
  useAuth.setState({
    accessToken: "test",
    status: "ready",
    user: {
      id: "u_adm",
      tenantId: "tenant_acme",
      name: "Admin",
      email: "admin@acme.test",
      username: "admin",
      roleId: "role_admin",
      role: role === "super_admin" ? "super_admin" : role,
      permissions: permissionsFor(role),
      mustChangePassword: false,
      ...overrides,
    },
  });
}

function renderAt(path = "/users") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/users" element={<UsersPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  // Route-aware, because the endpoints have genuinely different shapes:
  // /users is a paged envelope, /roles and /teams are plain arrays. A single
  // catch-all shape would make these tests pass against code that could not
  // work against the real API.
  vi.spyOn(api, "apiFetch").mockImplementation((path: string) => {
    if (path.startsWith("/roles")) return Promise.resolve([]);
    if (path.startsWith("/teams")) return Promise.resolve([]);
    if (path.startsWith("/permissions")) return Promise.resolve([]);
    return Promise.resolve({ items: [], nextCursor: null, total: 0 });
  });
});

describe("tab shell", () => {
  it("renders the Users tab by default", async () => {
    signIn("admin");
    renderAt();
    expect(await screen.findByRole("tab", { name: /Users/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("deep-links straight to Roles from ?tab=roles", async () => {
    signIn("admin");
    renderAt("/users?tab=roles");
    expect(
      await screen.findByRole("tab", { name: /Roles/ }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("deep-links straight to Teams from ?tab=teams", async () => {
    signIn("admin");
    renderAt("/users?tab=teams");
    expect(await screen.findByRole("tab", { name: /Teams/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches tab on click", async () => {
    signIn("admin");
    renderAt();
    await userEvent.click(screen.getByRole("tab", { name: /Teams/ }));
    expect(screen.getByRole("tab", { name: /Teams/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("falls back to Users for an unknown ?tab= value", async () => {
    signIn("admin");
    renderAt("/users?tab=nonsense");
    expect(await screen.findByRole("tab", { name: /Users/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("is a real tablist with a labelled panel", async () => {
    signIn("admin");
    renderAt();
    expect(await screen.findByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });

  it("moves selection with the right arrow key", async () => {
    signIn("admin");
    renderAt();
    const usersTab = await screen.findByRole("tab", { name: /Users/ });
    usersTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Roles/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("wraps around with the left arrow key", async () => {
    signIn("admin");
    renderAt();
    const usersTab = await screen.findByRole("tab", { name: /Users/ });
    usersTab.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /Teams/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

describe("permission gating", () => {
  it("hides Roles and Teams from a caller with neither permission", async () => {
    signIn("sales");
    renderAt();
    await screen.findByRole("tablist");
    expect(screen.queryByRole("tab", { name: /Roles/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Teams/ })).not.toBeInTheDocument();
  });

  it("falls back to Users when deep-linking to a tab you cannot use", async () => {
    signIn("sales");
    renderAt("/users?tab=roles");
    expect(await screen.findByRole("tab", { name: /Users/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows a permission-denied panel rather than an empty table", async () => {
    // An empty table would read as "there are no users", which is a different
    // and much more alarming claim than "you may not see them".
    signIn("sales");
    renderAt();
    expect(
      await screen.findByText(/do not have permission to manage users/i),
    ).toBeInTheDocument();
  });

  it("offers every tab to a super_admin", async () => {
    // The defect this covers: action visibility keyed off `role === "admin"`
    // hid everything from a super_admin, who is strictly more privileged.
    signIn("super_admin");
    renderAt();
    expect(await screen.findByRole("tab", { name: /Users/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Roles/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Teams/ })).toBeInTheDocument();
  });

  it("shows the Roles tab read-only to a user.manage-only caller", async () => {
    signIn("admin", { permissions: ["user.manage"] });
    renderAt("/users?tab=roles");
    expect(await screen.findByRole("tab", { name: /Roles/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(/Read-only/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add role/i }),
    ).not.toBeInTheDocument();
  });
});
