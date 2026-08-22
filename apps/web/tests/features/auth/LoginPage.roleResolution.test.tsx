import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "@/features/auth/LoginPage";

/**
 * `LoginPage` resolves its active role from the URL via `resolveRoleFromPath`
 * whenever it isn't handed an explicit `initialRole` (e.g. the generic
 * `/login/:roleParam` route). That function matches on the first path
 * segment (not a substring), so `/sales/login` must resolve to the
 * Salesperson portal and nothing else.
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

  // Regression for the brittle `.includes("sales")` match: a path whose
  // first segment merely CONTAINS "sales" as a substring (e.g. a future
  // `base` deploy path, or an unrelated route) must NOT resolve to the
  // Salesperson portal — only an exact first-segment match should.
  // Mutation-proof: reverting resolveRoleFromPath's segment check back to
  // `pathname.includes("sales")` makes this fail (verified in the fix report).
  it("does not resolve a path that merely CONTAINS \"sales\" as a substring to the Salesperson portal", () => {
    render(
      <MemoryRouter initialEntries={["/salesforce-integration/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Salesperson Portal")).not.toBeInTheDocument();
    expect(screen.getByText("Administrator Portal")).toBeInTheDocument();
  });
});
