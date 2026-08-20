import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireOwner } from "@/components/RequireOwner";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuth } from "@/store/auth";

function seedAuth(role: "super_admin" | "admin") {
  useAuth.setState({
    accessToken: "test",
    refreshToken: "test",
    user: {
      id: "u1",
      tenantId: "tenant_acme",
      name: "User",
      email: "user@acme.test",
      username: "user",
      roleId: `role_${role}`,
      role,
    },
  });
}

function renderAt() {
  return render(
    <MemoryRouter initialEntries={["/managements"]}>
      <Routes>
        <Route
          path="/managements"
          element={
            <RequireOwner>
              <div>home</div>
            </RequireOwner>
          }
        />
        <Route path="/managements/:id/dashboard" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireOwner", () => {
  beforeEach(() => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID });
    seedAuth("super_admin");
  });

  it("renders children for an owner", () => {
    renderAt();
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("redirects a non-owner to their management dashboard", () => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID });
    seedAuth("admin");
    renderAt();
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });
});
