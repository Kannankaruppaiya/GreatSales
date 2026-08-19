import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireOwner } from "../../src/components/RequireOwner";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../../src/store/ui";

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
  beforeEach(() => useUi.setState({ isOwner: true, activeManagementId: DEFAULT_MANAGEMENT_ID }));

  it("renders children for an owner", () => {
    renderAt();
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("redirects a non-owner to their management dashboard", () => {
    useUi.setState({ isOwner: false, activeManagementId: DEFAULT_MANAGEMENT_ID });
    renderAt();
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });
});
