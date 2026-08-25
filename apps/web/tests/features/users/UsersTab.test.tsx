import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UsersTab } from "@/features/users/tabs/UsersTab";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { permissionsFor } from "../../helpers/authFixtures";
import type { RoleRow, TeamRow, UserRow } from "@/features/users/types";

/**
 * The users table and its row actions.
 *
 * Four previously-broken behaviours are pinned here:
 *
 *   - the header count reads the SERVER's total, not the loaded page length;
 *   - "(you)" is matched on the real session id, not a mock-data id, so the
 *     self-guard actually engages;
 *   - filters go to the server, and the status filter sends `status=`, not the
 *     boolean that silently inverted;
 *   - destructive actions confirm before firing, and render the server's
 *     coded refusal rather than swallowing it.
 */
const ADMIN_ID = "u_adm";

const user = (over: Partial<UserRow> = {}): UserRow => ({
  id: "u_1",
  name: "Ramesh Kumar",
  email: "ramesh@acme.test",
  username: "ramesh",
  roleId: "role_sales",
  roleName: "sales",
  managerId: null,
  managerName: "Acme Manager",
  teamId: "team_1",
  teamName: "North Team",
  active: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
  ...over,
});

const ROLES: RoleRow[] = [
  {
    id: "role_sales",
    name: "sales",
    isSystem: true,
    permissionKeys: ["customer.read"],
    userCount: 3,
    createdAt: "",
    updatedAt: "",
  },
  {
    // A role with NO users. It must still be selectable, or that role could
    // never receive its first member.
    id: "role_viewer",
    name: "viewer",
    isSystem: false,
    permissionKeys: ["report.view"],
    userCount: 0,
    createdAt: "",
    updatedAt: "",
  },
];

const TEAMS: TeamRow[] = [
  {
    id: "team_1",
    name: "North Team",
    managerId: "u_mgr",
    managerName: "Acme Manager",
    memberCount: 2,
    createdAt: "",
    updatedAt: "",
  },
];

let fetchSpy: ReturnType<typeof vi.spyOn>;

function mockApi(
  users: UserRow[],
  total = users.length,
  overrides: { onMutate?: (path: string, init?: RequestInit) => unknown } = {},
) {
  fetchSpy = vi
    .spyOn(api, "apiFetch")
    .mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method && init.method !== "GET") {
        const result = overrides.onMutate?.(path, init);
        return result instanceof Promise ? result : Promise.resolve(result ?? {});
      }
      if (path.startsWith("/roles")) return Promise.resolve(ROLES);
      if (path.startsWith("/teams")) return Promise.resolve(TEAMS);
      if (path.startsWith("/permissions")) return Promise.resolve([]);
      return Promise.resolve({ items: users, nextCursor: null, total });
    }) as never;
  return fetchSpy;
}

function signIn(permissions = permissionsFor("admin")) {
  useAuth.setState({
    accessToken: "test",
    status: "ready",
    user: {
      id: ADMIN_ID,
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
      <MemoryRouter>
        <UsersTab />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** All GET urls the component requested, for asserting filter serialisation. */
const getUrls = () =>
  fetchSpy.mock.calls
    .filter((c) => !(c[1] as RequestInit | undefined)?.method)
    .map((c) => c[0] as string);

beforeEach(() => vi.restoreAllMocks());

describe("table", () => {
  it("renders every administrative column", async () => {
    mockApi([user()]);
    signIn();
    renderTab();

    await screen.findByText("Ramesh Kumar");
    for (const header of ["Role", "Team", "Manager", "Last login", "Status"]) {
      expect(
        screen.getByRole("columnheader", { name: new RegExp(header, "i") }),
      ).toBeInTheDocument();
    }
  });

  it("shows the SERVER total, not the number of loaded rows", async () => {
    mockApi([user(), user({ id: "u_2", name: "Second" })], 47);
    signIn();
    renderTab();
    expect(await screen.findByText("47 users")).toBeInTheDocument();
  });

  it("marks the signed-in user's own row with (you)", async () => {
    // Previously compared against a MOCK owner id, so this never matched and
    // the self-guard below never engaged.
    mockApi([user({ id: ADMIN_ID, name: "Admin" })]);
    signIn();
    renderTab();
    expect(await screen.findByText("(you)")).toBeInTheDocument();
  });

  it("gives the table a caption for screen readers", async () => {
    mockApi([user()]);
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");
    expect(screen.getByRole("table")).toHaveAccessibleName(/Users in this workspace/i);
  });

  it("renders an empty state that names the filters when one is set", async () => {
    mockApi([]);
    signIn();
    renderTab();
    await userEvent.type(screen.getByLabelText(/search users/i), "zzz");
    expect(
      await screen.findByText(/No users match those filters/i),
    ).toBeInTheDocument();
  });
});

describe("filters", () => {
  it("offers roles that have NO users", async () => {
    mockApi([user()]);
    signIn();
    renderTab();
    const roleFilter = await screen.findByLabelText(/filter by role/i);
    expect(await within(roleFilter).findByText("viewer")).toBeInTheDocument();
  });

  it("sends status= rather than a boolean that could invert", async () => {
    mockApi([user()]);
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");

    await userEvent.selectOptions(
      screen.getByLabelText(/filter by status/i),
      "inactive",
    );
    await vi.waitFor(() =>
      expect(getUrls().some((u) => u.includes("status=inactive"))).toBe(true),
    );
    expect(getUrls().some((u) => u.includes("active=false"))).toBe(false);
  });

  it("sends teamId when a team is chosen", async () => {
    mockApi([user()]);
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");

    await userEvent.selectOptions(
      screen.getByLabelText(/filter by team/i),
      "team_1",
    );
    await vi.waitFor(() =>
      expect(getUrls().some((u) => u.includes("teamId=team_1"))).toBe(true),
    );
  });

  it("requests deleted rows when Show deleted is ticked", async () => {
    mockApi([user()]);
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");

    await userEvent.click(screen.getByLabelText(/show deleted/i));
    await vi.waitFor(() =>
      expect(getUrls().some((u) => u.includes("includeDeleted=true"))).toBe(true),
    );
  });

  it("sorts on a header click and reflects it in aria-sort", async () => {
    mockApi([user()]);
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");

    await userEvent.click(screen.getByRole("button", { name: /^Email$/i }));
    await vi.waitFor(() =>
      expect(getUrls().some((u) => u.includes("sort=email"))).toBe(true),
    );
    expect(
      screen.getByRole("columnheader", { name: /email/i }),
    ).toHaveAttribute("aria-sort", "ascending");
  });

  it("reverses direction on a second click of the same header", async () => {
    mockApi([user()]);
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");

    // Asserted on the aria-sort state as well as the request, because the
    // request URL alone cannot distinguish "reversed" from "never changed".
    // Re-queried before each click: the header re-renders after the first
    // one, and clicking a detached node would silently do nothing.
    const emailHeader = () => screen.getByRole("button", { name: /^Email$/i });

    await userEvent.click(emailHeader());
    await vi.waitFor(() =>
      expect(
        screen.getByRole("columnheader", { name: /email/i }),
      ).toHaveAttribute("aria-sort", "ascending"),
    );

    await userEvent.click(emailHeader());
    await vi.waitFor(() =>
      expect(
        screen.getByRole("columnheader", { name: /email/i }),
      ).toHaveAttribute("aria-sort", "descending"),
    );
    await vi.waitFor(
      () => expect(getUrls().some((u) => u.includes("dir=desc"))).toBe(true),
      { timeout: 2000 },
    );
  });
});

describe("row actions", () => {
  it("asks for confirmation before deactivating, and fires nothing yet", async () => {
    const onMutate = vi.fn();
    mockApi([user()], 1, { onMutate });
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");

    await userEvent.click(screen.getByRole("button", { name: /Deactivate/i }));
    expect(
      await screen.findByText(/signed out of every device immediately/i),
    ).toBeInTheDocument();
    expect(onMutate).not.toHaveBeenCalled();
  });

  it("fires the PATCH once confirmed", async () => {
    const onMutate = vi.fn().mockReturnValue({});
    mockApi([user()], 1, { onMutate });
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");

    await userEvent.click(screen.getByRole("button", { name: /Deactivate/i }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /^Deactivate$/i,
      }),
    );

    await vi.waitFor(() => expect(onMutate).toHaveBeenCalled());
    const [path, init] = onMutate.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/users/u_1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toMatchObject({ active: false });
  });

  it("fires nothing when the confirmation is cancelled", async () => {
    const onMutate = vi.fn();
    mockApi([user()], 1, { onMutate });
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");

    await userEvent.click(screen.getByRole("button", { name: /Deactivate/i }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /Cancel/i,
      }),
    );
    expect(onMutate).not.toHaveBeenCalled();
  });

  it("warns that deleting frees the email for reuse", async () => {
    mockApi([user()]);
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");

    await userEvent.click(screen.getByRole("button", { name: /^Delete$/i }));
    expect(
      await screen.findByText(/become free for someone else to use/i),
    ).toBeInTheDocument();
  });

  it("offers Restore, not Delete, on a soft-deleted row", async () => {
    mockApi([user({ deletedAt: "2026-02-01T00:00:00.000Z" })]);
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");

    expect(screen.getByRole("button", { name: /Restore/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Delete$/i }),
    ).not.toBeInTheDocument();
  });

  it("offers no dangerous action on your OWN row, and says why", async () => {
    mockApi([user({ id: ADMIN_ID, name: "Admin" })]);
    signIn();
    renderTab();
    await screen.findByText("(you)");

    expect(
      screen.queryByRole("button", { name: /Deactivate/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Delete$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Reset password/i }),
    ).not.toBeInTheDocument();
    // Edit stays: renaming yourself is harmless and the server allows it.
    expect(screen.getByRole("button", { name: /^Edit$/i })).toBeInTheDocument();
    expect(screen.getByText(/your account/i)).toBeInTheDocument();
  });

  it("renders the server's LAST_ADMIN_PROTECTED refusal verbatim", async () => {
    const message =
      'This is the last user who can manage users. Give another user a role with the "Manage users" permission first.';
    const onMutate = vi
      .fn()
      .mockRejectedValue(new ApiError(409, message, undefined, "LAST_ADMIN_PROTECTED"));
    mockApi([user()], 1, { onMutate });
    signIn();
    renderTab();
    await screen.findByText("Ramesh Kumar");

    await userEvent.click(screen.getByRole("button", { name: /Deactivate/i }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /^Deactivate$/i,
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/last user who can manage users/i);
  });
});

describe("permission gate", () => {
  it("shows a denial panel instead of an empty table", async () => {
    mockApi([]);
    signIn(permissionsFor("sales"));
    renderTab();
    expect(
      await screen.findByText(/do not have permission to manage users/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("does not even request the list without permission", async () => {
    const spy = mockApi([]);
    signIn(permissionsFor("sales"));
    renderTab();
    await screen.findByText(/do not have permission/i);
    expect(spy).not.toHaveBeenCalled();
  });
});
