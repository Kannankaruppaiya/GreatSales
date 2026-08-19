import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../src/store/ui";

describe("App routing", () => {
  beforeEach(() =>
    useUi.setState({ authed: true, isOwner: true, activeManagementId: DEFAULT_MANAGEMENT_ID }),
  );

  it("owner hitting / lands on the management home", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/create management/i)).toBeInTheDocument();
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
