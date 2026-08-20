import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UsersPage from "@/features/users/UsersPage";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import type { UserRow } from "@/features/users/types";

const existingUser: UserRow = {
  id: "u_adm",
  name: "Admin",
  email: "admin@acme.test",
  username: "admin",
  roleId: "role_admin",
  roleName: "Administrator",
  managerId: null,
  managerName: null,
  teamId: null,
  teamName: null,
  active: true,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderUsersPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <UsersPage />
    </QueryClientProvider>,
  );
}

describe("UsersPage add user", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuth.setState({
      accessToken: "test",
      refreshToken: "test",
      user: {
        id: "u_adm",
        tenantId: "tenant_acme",
        name: "Admin",
        email: "admin@acme.test",
        username: "admin",
        roleId: "role_admin",
        role: "admin",
      },
    });
  });

  it("adds a user to the current management via the add-user modal", async () => {
    const created: UserRow = { ...existingUser, id: "u_new", name: "Test Person", email: "test@example.com", username: "testperson" };
    const spy = vi.spyOn(api, "apiFetch").mockImplementation((_path, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET") return Promise.resolve({ items: [existingUser], nextCursor: null });
      if (method === "POST") return Promise.resolve(created);
      return Promise.resolve(null);
    });

    renderUsersPage();

    // Wait for the initial list load so role options (derived from loaded
    // rows) are populated before opening the add-user modal.
    await screen.findByText("Admin");

    await userEvent.click(screen.getByRole("button", { name: /add user/i }));
    await userEvent.type(screen.getByPlaceholderText("e.g. Ramesh Kumar"), "Test Person");
    await userEvent.type(screen.getByPlaceholderText("e.g. ramesh"), "testperson");
    await userEvent.type(screen.getByPlaceholderText("ramesh@greatsales.in"), "test@example.com");
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    await userEvent.type(passwordInput, "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: /create user/i }));

    const postCall = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body).toMatchObject({
      name: "Test Person",
      username: "testperson",
      email: "test@example.com",
      password: "Passw0rd!",
      roleId: "role_admin",
    });
  });
});
