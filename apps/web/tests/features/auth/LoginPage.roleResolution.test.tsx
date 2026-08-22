import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "@/features/auth/LoginPage";

/**
 * `LoginPage` resolves its active role from the URL via `resolveRoleFromPath`
 * whenever it isn't handed an explicit `initialRole` (e.g. the generic
 * `/login/:roleParam` route). That function matches on substrings, so the
 * `sales` check must be tested (and kept) ahead of the `admin` check —
 * otherwise a future edit could reorder them without any other signal.
 *
 * This renders `LoginPage` directly (no `initialRole` prop, no route match
 * for `:roleParam`) so `resolveRoleFromPath` is exercised the same way it
 * would be for any path it hasn't seen an explicit role for.
 */
describe("LoginPage role resolution from the URL", () => {
  it("resolves /sales/login to the Salesperson portal, not Administrator", () => {
    render(
      <MemoryRouter initialEntries={["/sales/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Salesperson Portal")).toBeInTheDocument();
    expect(screen.getByText("FIELD SALES")).toBeInTheDocument();
    expect(screen.queryByText("Administrator Portal")).not.toBeInTheDocument();
  });
});
