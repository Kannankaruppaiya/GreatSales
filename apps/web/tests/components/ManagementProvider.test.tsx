import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ManagementProvider } from "@/features/management/ManagementProvider";
import { useUi } from "@/store/ui";
import { useAuth } from "@/store/auth";
import { usePlatformAuth } from "@/store/platformAuth";
import { permissionsFor } from "../helpers/authFixtures";

/** A tenant session belonging to `tenantId`. */
function seedAuth(tenantId: string, role: "super_admin" | "admin" = "admin") {
  useAuth.setState({
    accessToken: "test",
    user: {
      id: "u1",
      tenantId,
      name: "User",
      email: "user@acme.test",
      username: "user",
      roleId: `role_${role}`,
      role,
      permissions: permissionsFor(role),
      mustChangePassword: false,
    },
    status: "ready",
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/managements/:managementId/dashboard"
          element={
            <ManagementProvider>
              <div>inside</div>
            </ManagementProvider>
          }
        />
        <Route path="/managements" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ManagementProvider", () => {
  beforeEach(() => {
    usePlatformAuth.setState({ accessToken: null, platformUser: null });
    useUi.setState({ activeManagementId: null });
  });

  it("renders the workspace when the tenant session matches the URL", () => {
    seedAuth("tenant_acme");
    renderAt("/managements/tenant_acme/dashboard");
    expect(screen.getByText("inside")).toBeInTheDocument();
    expect(useUi.getState().activeManagementId).toBe("tenant_acme");
  });

  it("sends an owner back to Home when the session does not match the URL", () => {
    // An owner is signed in to the platform surface but has not assumed this
    // management (no matching tenant session) → bounce to the grid to pick one.
    seedAuth("tenant_acme");
    usePlatformAuth.setState({
      accessToken: "platform",
      platformUser: { id: "pu", name: "Owner", email: "o@x.io", role: "SuperAdmin" },
    });
    renderAt("/managements/tenant_globex/dashboard");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("bounces a plain tenant user to their OWN workspace, never the foreign one", () => {
    seedAuth("tenant_acme");
    renderAt("/managements/tenant_globex/dashboard");
    // The redirect lands on their own management, which matches and renders.
    // The foreign id (tenant_globex) is never the one that gets activated.
    expect(screen.getByText("inside")).toBeInTheDocument();
    expect(useUi.getState().activeManagementId).toBe("tenant_acme");
  });
});
