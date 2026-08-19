import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsersPage from "../../src/pages/UsersPage";
import { useUi } from "../../src/store/ui";
import { useTrackerStore } from "../../src/store/trackerStore";

describe("UsersPage add user", () => {
  beforeEach(() => useUi.setState({ role: "admin", ownerId: "u_adm" }));

  it("adds a user to the current management via the add-user modal", async () => {
    const before = useTrackerStore.getState().users.length;
    render(<UsersPage />);

    await userEvent.click(screen.getByRole("button", { name: /add user/i }));
    await userEvent.type(screen.getByPlaceholderText("e.g. Ramesh Kumar"), "Test Person");
    await userEvent.type(screen.getByPlaceholderText("e.g. ramesh"), "testperson");
    await userEvent.type(screen.getByPlaceholderText("ramesh@greatsales.in"), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: /create user/i }));

    const after = useTrackerStore.getState().users;
    expect(after.length).toBe(before + 1);
    expect(after.some((u) => u.email === "test@example.com")).toBe(true);
  });
});
