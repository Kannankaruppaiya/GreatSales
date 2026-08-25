import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TeamsTab } from "@/features/users/tabs/TeamsTab";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { permissionsFor } from "../../helpers/authFixtures";
import type { TeamRow, UserRow } from "@/features/users/types";

/**
 * Teams and membership.
 *
 * The behaviour most worth pinning is the delete confirmation. "Delete team"
 * reads as though it might take the people with it; it does not, and the
 * dialog has to say so before an administrator finds out the hard way.
 */
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

const member = (over: Partial<UserRow> = {}): UserRow => ({
  id: "u_1",
  name: "Ramesh Kumar",
  email: "ramesh@acme.test",
  username: "ramesh",
  roleId: "role_sales",
  roleName: "sales",
  managerId: null,
  managerName: null,
  teamId: "team_1",
  teamName: "North Team",
  active: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
  ...over,
});

function mockApi(
  teams: TeamRow[] = TEAMS,
  onMutate?: (path: string, init?: RequestInit) => unknown,
) {
  const spy = vi.spyOn(api, "apiFetch");
  spy.mockImplementation(((path: string, init?: RequestInit) => {
      if (init?.method && init.method !== "GET") {
        const r = onMutate?.(path, init);
        return r instanceof Promise ? r : Promise.resolve(r ?? {});
      }
      if (path.includes("/members")) return Promise.resolve([member()]);
      if (path.startsWith("/teams")) return Promise.resolve(teams);
      if (path.startsWith("/roles")) return Promise.resolve([]);
      if (path.startsWith("/permissions")) return Promise.resolve([]);
      return Promise.resolve({
        items: [member({ id: "u_free", name: "Free Agent", teamId: null })],
        nextCursor: null,
        total: 1,
      });
    }) as typeof api.apiFetch);
  return spy;
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
      <TeamsTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.restoreAllMocks());

describe("team list", () => {
  it("shows each team with its manager and member count", async () => {
    mockApi();
    signIn();
    renderTab();

    const row = await screen.findByRole("row", { name: /North Team/i });
    expect(within(row).getByText("Acme Manager")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
  });

  it("offers an actionable empty state rather than a dead end", async () => {
    mockApi([]);
    signIn();
    renderTab();
    expect(
      await screen.findByText(/Create your first team/i),
    ).toBeInTheDocument();
  });

  it("has a caption naming what the table shows", async () => {
    mockApi();
    signIn();
    renderTab();
    await screen.findByRole("row", { name: /North Team/i });
    expect(screen.getByRole("table")).toHaveAccessibleName(
      /Teams, their managers/i,
    );
  });
});

describe("membership", () => {
  it("loads members only once the row is expanded", async () => {
    const spy = mockApi();
    signIn();
    renderTab();
    await screen.findByRole("row", { name: /North Team/i });

    const memberCallsBefore = spy.mock.calls.filter((call) =>
      String(call[0]).includes("/members"),
    ).length;
    expect(memberCallsBefore).toBe(0);

    await userEvent.click(screen.getByRole("button", { name: "North Team" }));
    await screen.findByText("Ramesh Kumar");
  });

  it("adds a member and posts the chosen id", async () => {
    const onMutate = vi.fn().mockReturnValue({ added: 1 });
    mockApi(TEAMS, onMutate);
    signIn();
    renderTab();

    await userEvent.click(
      await screen.findByRole("button", { name: "North Team" }),
    );
    await userEvent.selectOptions(
      await screen.findByLabelText(/Add a member to North Team/i),
      "u_free",
    );
    await userEvent.click(screen.getByRole("button", { name: /^Add$/i }));

    await vi.waitFor(() => expect(onMutate).toHaveBeenCalled());
    const [path, init] = onMutate.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/teams/team_1/members");
    expect(JSON.parse(init.body as string)).toEqual({ userIds: ["u_free"] });
  });

  it("removes a member with a DELETE", async () => {
    const onMutate = vi.fn().mockReturnValue({});
    mockApi(TEAMS, onMutate);
    signIn();
    renderTab();

    await userEvent.click(
      await screen.findByRole("button", { name: "North Team" }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: /Remove Ramesh Kumar from North Team/i,
      }),
    );

    await vi.waitFor(() => expect(onMutate).toHaveBeenCalled());
    const [path, init] = onMutate.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/teams/team_1/members/u_1");
    expect(init.method).toBe("DELETE");
  });

  it("surfaces a server refusal when adding fails", async () => {
    const onMutate = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, "One or more of those users does not exist in this workspace.", undefined, "INVALID_REFERENCE"),
      );
    mockApi(TEAMS, onMutate);
    signIn();
    renderTab();

    await userEvent.click(
      await screen.findByRole("button", { name: "North Team" }),
    );
    await userEvent.selectOptions(
      await screen.findByLabelText(/Add a member to North Team/i),
      "u_free",
    );
    await userEvent.click(screen.getByRole("button", { name: /^Add$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /does not exist in this workspace/i,
    );
  });
});

describe("delete", () => {
  it("states that members are unassigned, NOT deleted", async () => {
    const onMutate = vi.fn();
    mockApi(TEAMS, onMutate);
    signIn();
    renderTab();

    await userEvent.click(
      await screen.findByRole("button", { name: /Delete team North Team/i }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/unassigned from any team/i);
    expect(dialog).toHaveTextContent(/Nobody is deleted/i);
    expect(onMutate).not.toHaveBeenCalled();
  });

  it("fires the DELETE once confirmed", async () => {
    const onMutate = vi.fn().mockReturnValue({});
    mockApi(TEAMS, onMutate);
    signIn();
    renderTab();

    await userEvent.click(
      await screen.findByRole("button", { name: /Delete team North Team/i }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /Delete team/i,
      }),
    );

    await vi.waitFor(() => expect(onMutate).toHaveBeenCalled());
    expect(onMutate.mock.calls[0][0]).toBe("/teams/team_1");
  });
});

describe("permission gate", () => {
  it("shows a denial panel without user.manage", async () => {
    mockApi();
    signIn(permissionsFor("sales"));
    renderTab();
    expect(
      await screen.findByText(/do not have permission to manage teams/i),
    ).toBeInTheDocument();
  });
});
