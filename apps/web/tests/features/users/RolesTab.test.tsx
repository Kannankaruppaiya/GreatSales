import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RolesTab } from "@/features/users/tabs/RolesTab";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { permissionsFor } from "../../helpers/authFixtures";
import type { PermissionGroup, RoleRow } from "@/features/users/types";

/**
 * The permission matrix.
 *
 * This replaces a hardcoded reference table that had no connection to actual
 * grants — it could claim a role allowed something it did not, and nothing
 * would catch it. The central assertion here is therefore that every checkbox
 * comes from the API, and that the old static copy is gone.
 */
const ROLES: RoleRow[] = [
  {
    id: "role_admin",
    name: "admin",
    isSystem: true,
    permissionKeys: ["user.manage", "role.manage", "customer.read"],
    userCount: 2,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "role_sales",
    name: "sales",
    isSystem: true,
    permissionKeys: ["customer.read"],
    userCount: 5,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "role_viewer",
    name: "viewer",
    isSystem: false,
    permissionKeys: ["customer.read"],
    userCount: 0,
    createdAt: "",
    updatedAt: "",
  },
];

const CATALOG: PermissionGroup[] = [
  {
    module: "Customers",
    permissions: [{ key: "customer.read", label: "View customers" }],
  },
  {
    module: "Administration",
    permissions: [
      { key: "user.manage", label: "Manage users" },
      { key: "role.manage", label: "Manage roles and permissions" },
    ],
  },
];

let fetchSpy: ReturnType<typeof vi.spyOn>;

function mockApi(
  roles: RoleRow[] = ROLES,
  onMutate?: (path: string, init?: RequestInit) => unknown,
) {
  fetchSpy = vi
    .spyOn(api, "apiFetch")
    .mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method && init.method !== "GET") {
        const r = onMutate?.(path, init);
        return r instanceof Promise ? r : Promise.resolve(r ?? {});
      }
      if (path.startsWith("/permissions")) return Promise.resolve(CATALOG);
      if (path.startsWith("/roles")) return Promise.resolve(roles);
      if (path.startsWith("/teams")) return Promise.resolve([]);
      return Promise.resolve({ items: [], nextCursor: null, total: 0 });
    }) as never;
  return fetchSpy;
}

function signIn(permissions = permissionsFor("admin")) {
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
      role: "admin",
      permissions,
      mustChangePassword: false,
    },
  });
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RolesTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.restoreAllMocks());

describe("matrix", () => {
  it("renders one row per role, including a role with no users", async () => {
    mockApi();
    signIn();
    renderTab();
    expect(await screen.findByRole("rowheader", { name: /admin/i })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /viewer/i })).toBeInTheDocument();
  });

  it("checkboxes reflect the REAL grants the API returned", async () => {
    mockApi();
    signIn();
    renderTab();

    expect(
      await screen.findByRole("checkbox", { name: /Manage users for admin/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Manage users for sales/i }),
    ).not.toBeChecked();
  });

  it("no hardcoded permission copy survives", async () => {
    // The table this replaced described modules the API has never had a
    // permission for. If any of it comes back, it is lying again.
    mockApi();
    signIn();
    const { container } = renderTab();
    await screen.findByRole("rowheader", { name: /admin/i });

    expect(container.textContent).not.toMatch(/Projections & follow-ups/i);
    expect(container.textContent).not.toMatch(/Create \/ edit own only/i);
    expect(container.textContent).not.toMatch(/Full — all salespersons/i);
  });

  it("shows a live user count per role", async () => {
    mockApi();
    signIn();
    renderTab();
    const row = await screen.findByRole("row", { name: /sales/i });
    expect(within(row).getByText("5")).toBeInTheDocument();
  });

  it("marks a system role with a lock", async () => {
    mockApi();
    signIn();
    renderTab();
    // Two of the three fixture roles are built in, so both must carry it.
    const locks = await screen.findAllByRole("img", {
      name: /Built-in role/i,
    });
    expect(locks).toHaveLength(2);
  });

  it("has a caption naming what the matrix shows", async () => {
    mockApi();
    signIn();
    renderTab();
    await screen.findByRole("rowheader", { name: /admin/i });
    expect(screen.getByRole("table")).toHaveAccessibleName(
      /Which permissions each role grants/i,
    );
  });
});

describe("editing", () => {
  it("PATCHes the role with the full new grant set when a box is ticked", async () => {
    const onMutate = vi.fn().mockReturnValue(ROLES[1]);
    mockApi(ROLES, onMutate);
    signIn();
    renderTab();

    await userEvent.click(
      await screen.findByRole("checkbox", { name: /View customers for viewer/i }),
    );

    await vi.waitFor(() => expect(onMutate).toHaveBeenCalled());
    const [path, init] = onMutate.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/roles/role_viewer");
    expect(init.method).toBe("PATCH");
    // Wholesale replacement: unticking the only grant sends an empty set,
    // never a "remove this one" delta the server would have to interpret.
    expect(JSON.parse(init.body as string)).toEqual({ permissionKeys: [] });
  });

  it("disables the last admin-role checkbox and explains why", async () => {
    // Only `admin` grants user.manage and has users, so the server would
    // refuse to remove it. Saying so up front beats a failed round trip.
    mockApi();
    signIn();
    renderTab();

    const box = await screen.findByRole("checkbox", {
      name: /Manage users for admin/i,
    });
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute("title", expect.stringMatching(/last role with users/i));
  });

  it("renders the server's LAST_ADMIN_ROLE_PROTECTED refusal", async () => {
    const onMutate = vi
      .fn()
      .mockRejectedValue(
        new ApiError(409, "This is the last role with active users that can \"Manage users\".", undefined, "LAST_ADMIN_ROLE_PROTECTED"),
      );
    mockApi(ROLES, onMutate);
    signIn();
    renderTab();

    await userEvent.click(
      await screen.findByRole("checkbox", { name: /View customers for viewer/i }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /last role with active users/i,
    );
  });

  it("offers delete only on custom roles", async () => {
    mockApi();
    signIn();
    renderTab();
    await screen.findByRole("rowheader", { name: /admin/i });

    expect(
      screen.getByRole("button", { name: /Delete role viewer/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete role admin/i }),
    ).not.toBeInTheDocument();
  });

  it("confirms before deleting a role", async () => {
    const onMutate = vi.fn();
    mockApi(ROLES, onMutate);
    signIn();
    renderTab();

    await userEvent.click(
      await screen.findByRole("button", { name: /Delete role viewer/i }),
    );
    expect(await screen.findByRole("dialog")).toHaveTextContent(/cannot be undone/i);
    expect(onMutate).not.toHaveBeenCalled();
  });
});

describe("read-only mode", () => {
  it("disables every checkbox for a user.manage-only caller", async () => {
    mockApi();
    signIn(["user.manage"]);
    renderTab();

    const box = await screen.findByRole("checkbox", {
      name: /View customers for viewer/i,
    });
    expect(box).toBeDisabled();
    expect(screen.getByText(/Read-only/i)).toBeInTheDocument();
  });

  it("shows a denial panel to a caller with neither permission", async () => {
    mockApi();
    signIn(permissionsFor("sales"));
    renderTab();
    expect(
      await screen.findByText(/do not have permission to view roles/i),
    ).toBeInTheDocument();
  });
});
