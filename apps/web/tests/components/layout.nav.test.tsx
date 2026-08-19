import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "../../src/components/layout";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../../src/store/ui";

describe("Sidebar links", () => {
  beforeEach(() =>
    useUi.setState({ role: "admin", activeManagementId: DEFAULT_MANAGEMENT_ID, sidebarOpen: true }),
  );

  it("prefixes nav links with the active management id", () => {
    render(
      <MemoryRouter>
        <Sidebar onOpenCommandPalette={() => {}} />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /dashboard/i });
    expect(link.getAttribute("href")).toBe(`/managements/${DEFAULT_MANAGEMENT_ID}/dashboard`);
  });
});
