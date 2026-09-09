import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "@/features/auth/LoginPage";
import { useAuth } from "@/store/auth";
import { ApiError } from "@/lib/api";

/**
 * What the person at the login form actually experiences.
 *
 * The server answers every bad-credential case identically on purpose, so the
 * page must not invent a friendlier, more specific reason for a 401 — that
 * would re-introduce the account enumeration the API avoids. Outcomes that ARE
 * genuinely different (throttled, locked, unreachable) must be distinguishable,
 * because the user's next action differs in each case.
 */
const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => navigate };
});

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={["/admin/login"]}>
      <LoginPage initialRole="admin" />
    </MemoryRouter>,
  );

/** Fill the form regardless of what the dev prefill did or did not supply. */
async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  const tenant = screen.getByLabelText(/tenant id/i);
  const email = screen.getByLabelText(/email address/i);
  const password = screen.getByLabelText(/password/i);
  await user.clear(tenant);
  await user.type(tenant, "tenant_acme");
  await user.clear(email);
  await user.type(email, "admin@acme.test");
  await user.clear(password);
  await user.type(password, "Passw0rd!");
}

/**
 * The submit button's accessible name changes while the request is in flight
 * ("Sign In to …" → "Authenticating …"), which is deliberate progress
 * feedback — so match either form rather than losing the element mid-test.
 */
const submit = () =>
  screen.getByRole("button", { name: /sign in|authenticating/i });

let login: ReturnType<typeof vi.fn>;

beforeEach(() => {
  navigate.mockReset();
  login = vi.fn().mockResolvedValue(undefined);
  useAuth.setState({
    accessToken: null,
    user: null,
    lastTenantId: null,
    status: "ready",
    login,
  });
});

describe("LoginPage — accessibility", () => {
  it("labels every field so a screen reader can announce it", () => {
    renderLogin();
    expect(screen.getByLabelText(/tenant id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("uses input types and autocomplete a password manager understands", () => {
    renderLogin();
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute(
      "autocomplete",
      "username",
    );
    const pw = screen.getByLabelText(/password/i);
    expect(pw).toHaveAttribute("type", "password");
    expect(pw).toHaveAttribute("autocomplete", "current-password");
  });
});

describe("LoginPage — success", () => {
  it("signs in and moves the user on", async () => {
    const user = userEvent.setup();
    renderLogin();
    await fillForm(user);
    await user.click(submit());

    await waitFor(() =>
      // The fourth argument is the door. Rendered at /admin/login, so the
      // server is told "admin" and will refuse any other role here.
      expect(login).toHaveBeenCalledWith(
        "tenant_acme",
        "admin@acme.test",
        "Passw0rd!",
        "admin",
      ),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it("trims accidental whitespace rather than failing the sign-in", async () => {
    const user = userEvent.setup();
    renderLogin();
    const tenant = screen.getByLabelText(/tenant id/i);
    const email = screen.getByLabelText(/email address/i);
    const password = screen.getByLabelText(/password/i);
    await user.clear(tenant);
    await user.type(tenant, "  tenant_acme  ");
    await user.clear(email);
    await user.type(email, "admin@acme.test");
    await user.clear(password);
    await user.type(password, "Passw0rd!");
    await user.click(submit());

    await waitFor(() =>
      // The fourth argument is the door. Rendered at /admin/login, so the
      // server is told "admin" and will refuse any other role here.
      expect(login).toHaveBeenCalledWith(
        "tenant_acme",
        "admin@acme.test",
        "Passw0rd!",
        "admin",
      ),
    );
  });
});

describe("LoginPage — failure states", () => {
  const expectAlert = async (pattern: RegExp) => {
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(pattern);
  };

  it("shows one non-specific message for bad credentials", async () => {
    login.mockRejectedValue(new ApiError(401, "Invalid credentials"));
    const user = userEvent.setup();
    renderLogin();
    await fillForm(user);
    await user.click(submit());

    await expectAlert(/not correct/i);
    // Must not hint at which half was wrong, or whether the account exists.
    const alert = screen.getByRole("alert");
    expect(alert.textContent).not.toMatch(/no such|not found|unknown user/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("tells a throttled user to wait rather than retry blindly", async () => {
    login.mockRejectedValue(new ApiError(429, "ThrottlerException"));
    const user = userEvent.setup();
    renderLogin();
    await fillForm(user);
    await user.click(submit());

    await expectAlert(/too many sign-in attempts/i);
  });

  it("passes the server's lockout explanation straight through", async () => {
    login.mockRejectedValue(
      new ApiError(
        403,
        "Account temporarily locked after repeated failed sign-in attempts. Try again later.",
      ),
    );
    const user = userEvent.setup();
    renderLogin();
    await fillForm(user);
    await user.click(submit());

    await expectAlert(/locked/i);
  });

  it("distinguishes an unreachable server from a rejected credential", async () => {
    login.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderLogin();
    await fillForm(user);
    await user.click(submit());

    await expectAlert(/could not reach the server/i);
  });

  it("does not blame the user for a server fault", async () => {
    login.mockRejectedValue(new ApiError(500, "Internal server error"));
    const user = userEvent.setup();
    renderLogin();
    await fillForm(user);
    await user.click(submit());

    await expectAlert(/server had a problem/i);
  });

  it("links the error to the fields for assistive tech", async () => {
    login.mockRejectedValue(new ApiError(401, "Invalid credentials"));
    const user = userEvent.setup();
    renderLogin();
    await fillForm(user);
    await user.click(submit());

    await screen.findByRole("alert");
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute(
      "aria-describedby",
      "login-error",
    );
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("clears a stale error when the user tries again", async () => {
    login.mockRejectedValueOnce(new ApiError(401, "Invalid credentials"));
    const user = userEvent.setup();
    renderLogin();
    await fillForm(user);
    await user.click(submit());
    await screen.findByRole("alert");

    login.mockResolvedValueOnce(undefined);
    await user.click(submit());

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});

describe("LoginPage — in-flight behaviour", () => {
  it("does not spend a second attempt on a double click", async () => {
    let release!: () => void;
    login.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const user = userEvent.setup();
    renderLogin();
    await fillForm(user);

    await user.click(submit());
    await user.click(submit()); // impatient second click
    await user.click(submit());

    expect(login).toHaveBeenCalledTimes(1);
    release();
  });

  it("disables the form while the request is in flight", async () => {
    let release!: () => void;
    login.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const user = userEvent.setup();
    renderLogin();
    await fillForm(user);
    await user.click(submit());

    await waitFor(() => expect(submit()).toBeDisabled());
    expect(screen.getByLabelText(/email address/i)).toBeDisabled();
    expect(screen.getByLabelText(/password/i)).toBeDisabled();
    expect(submit()).toHaveAttribute("aria-busy", "true");

    release();
  });

  it("re-enables the form after a failure so the user can correct it", async () => {
    login.mockRejectedValue(new ApiError(401, "Invalid credentials"));
    const user = userEvent.setup();
    renderLogin();
    await fillForm(user);
    await user.click(submit());

    await screen.findByRole("alert");
    await waitFor(() => expect(submit()).not.toBeDisabled());
    expect(screen.getByLabelText(/password/i)).not.toBeDisabled();
  });
});

describe("LoginPage — remembered workspace", () => {
  it("prefills the workspace from the previous sign-in", () => {
    useAuth.setState({ lastTenantId: "tenant_globex" });
    renderLogin();
    expect(screen.getByLabelText(/tenant id/i)).toHaveValue("tenant_globex");
  });
});
