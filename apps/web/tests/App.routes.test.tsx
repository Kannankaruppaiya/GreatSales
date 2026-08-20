import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../src/store/ui";
import { useAuth } from "../src/store/auth";

describe("App routing", () => {
  beforeEach(() => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID });
    useAuth.setState({
      accessToken: "test",
      refreshToken: "test",
      user: {
        id: "u1",
        tenantId: "tenant_acme",
        name: "Owner",
        email: "owner@acme.test",
        username: "owner",
        roleId: "role_super_admin",
        role: "super_admin",
      },
    });
  });

  it("owner hitting / lands on the management home", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/super admin hub/i)).toBeInTheDocument();
  });

  it("opening a management renders the dashboard shell", async () => {
    render(
      <MemoryRouter initialEntries={[`/managements/${DEFAULT_MANAGEMENT_ID}/dashboard`]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/executive overview/i)).toBeInTheDocument();
  });
});
