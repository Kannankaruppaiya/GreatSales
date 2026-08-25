import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ChangePasswordPage from "@/features/auth/ChangePasswordPage";
import { useAuth } from "@/store/auth";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { permissionsFor } from "../../helpers/authFixtures";

/**
 * The way out of a forced password change.
 *
 * Without this screen the flag is a trap: an administrator resets someone's
 * password, that person signs in successfully, and is then refused by every
 * endpoint with no route that would let them fix it.
 */
const NEW_PASSWORD = "towel-forty-two-vogon";

function signIn(mustChangePassword = true) {
  useAuth.setState({
    accessToken: "test",
    status: "ready",
    user: {
      id: "u_1",
      tenantId: "tenant_acme",
      name: "Ramesh Kumar",
      email: "ramesh@acme.test",
      username: "ramesh",
      roleId: "role_sales",
      role: "sales",
      permissions: permissionsFor("sales"),
      mustChangePassword,
    },
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/change-password"]}>
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillAndSubmit(current = "Passw0rd!", next = NEW_PASSWORD) {
  await userEvent.type(screen.getByLabelText(/current password/i), current);
  await userEvent.type(screen.getByLabelText(/^New password/), next);
  await userEvent.click(screen.getByRole("button", { name: /Set new password/i }));
}

beforeEach(() => vi.restoreAllMocks());

describe("the form", () => {
  it("explains why the change is being asked for", () => {
    signIn();
    renderPage();
    expect(
      screen.getByText(/An administrator set the password you just used/i),
    ).toBeInTheDocument();
  });

  it("warns that other devices will be signed out", () => {
    signIn();
    renderPage();
    expect(
      screen.getByText(/signs you out on every other device/i),
    ).toBeInTheDocument();
  });

  it("posts both passwords to /auth/change-password", async () => {
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ revoked: 1 } as never);
    signIn();
    renderPage();

    await fillAndSubmit();

    const call = spy.mock.calls.find(
      (c) => c[0] === "/auth/change-password",
    ) as [string, RequestInit];
    expect(call).toBeDefined();
    expect(JSON.parse(call[1].body as string)).toEqual({
      currentPassword: "Passw0rd!",
      newPassword: NEW_PASSWORD,
    });
  });

  it("re-reads the profile so the flag clears, then leaves the screen", async () => {
    // Without the re-read, the route guard would bounce straight back here
    // even though the server has already accepted the change.
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockImplementation((path: string) => {
        if (path === "/auth/me")
          return Promise.resolve({
            ...useAuth.getState().user,
            mustChangePassword: false,
          }) as never;
        return Promise.resolve({ revoked: 0 }) as never;
      });
    signIn();
    renderPage();

    await fillAndSubmit();

    expect(spy.mock.calls.some((c) => c[0] === "/auth/me")).toBe(true);
    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(useAuth.getState().user?.mustChangePassword).toBe(false);
  });

  it("says the current password is wrong on a 401", async () => {
    vi.spyOn(api, "apiFetch").mockRejectedValue(
      new ApiError(401, "Invalid credentials"),
    );
    signIn();
    renderPage();

    await fillAndSubmit("wrong-password");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /current password is not correct/i,
    );
  });

  it("shows the server's WEAK_PASSWORD message on the new-password field", async () => {
    vi.spyOn(api, "apiFetch").mockRejectedValue(
      new ApiError(
        400,
        "That password is too common. Choose something less predictable.",
        undefined,
        "WEAK_PASSWORD",
      ),
    );
    signIn();
    renderPage();

    await fillAndSubmit("Passw0rd!", "password123456");
    expect(await screen.findByText(/too common/i)).toBeInTheDocument();
  });

  it("keeps the user here when the change is refused", async () => {
    vi.spyOn(api, "apiFetch").mockRejectedValue(
      new ApiError(401, "Invalid credentials"),
    );
    signIn();
    renderPage();

    await fillAndSubmit("wrong-password");
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("disables submit until both fields are filled", () => {
    signIn();
    renderPage();
    expect(
      screen.getByRole("button", { name: /Set new password/i }),
    ).toBeDisabled();
  });

  it("always offers a way out — this is never a locked room", () => {
    signIn();
    renderPage();
    expect(
      screen.getByRole("button", { name: /Sign out instead/i }),
    ).toBeInTheDocument();
  });
});
