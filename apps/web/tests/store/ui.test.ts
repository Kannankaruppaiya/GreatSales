import { describe, it, expect, beforeEach } from "vitest";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../../src/store/ui";

describe("useUi tenant state", () => {
  beforeEach(() => {
    useUi.setState({ isOwner: true, activeManagementId: DEFAULT_MANAGEMENT_ID });
  });

  it("defaults to owner on the default management", () => {
    expect(useUi.getState().isOwner).toBe(true);
    expect(useUi.getState().activeManagementId).toBe(DEFAULT_MANAGEMENT_ID);
  });

  it("setOwner toggles owner flag", () => {
    useUi.getState().setOwner(false);
    expect(useUi.getState().isOwner).toBe(false);
  });

  it("setActiveManagement changes the active id", () => {
    useUi.getState().setActiveManagement("m_acme");
    expect(useUi.getState().activeManagementId).toBe("m_acme");
  });

  it("never restores a stale isOwner:false from storage (owner is not dumped into a management)", async () => {
    localStorage.setItem(
      "greatsales_ui_state",
      JSON.stringify({
        state: { authed: true, role: "admin", ownerId: "u_adm", isOwner: false, activeManagementId: DEFAULT_MANAGEMENT_ID },
        version: 4,
      }),
    );
    await useUi.persist.rehydrate();
    expect(useUi.getState().isOwner).toBe(true);
  });
});
