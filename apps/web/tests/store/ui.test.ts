import { describe, it, expect, beforeEach } from "vitest";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../../src/store/ui";

describe("useUi tenant state", () => {
  beforeEach(() => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID });
  });

  it("defaults to the default management", () => {
    expect(useUi.getState().activeManagementId).toBe(DEFAULT_MANAGEMENT_ID);
  });

  it("setActiveManagement changes the active id", () => {
    useUi.getState().setActiveManagement("m_acme");
    expect(useUi.getState().activeManagementId).toBe("m_acme");
  });

  it("migration drops legacy auth fields from persisted storage (auth now lives in useAuth)", async () => {
    localStorage.setItem(
      "greatsales_ui_state",
      JSON.stringify({
        state: {
          authed: true,
          role: "admin",
          ownerId: "u_adm",
          isOwner: false,
          activeManagementId: DEFAULT_MANAGEMENT_ID,
        },
        version: 4,
      }),
    );
    await useUi.persist.rehydrate();
    const state = useUi.getState() as unknown as Record<string, unknown>;
    expect(state.authed).toBeUndefined();
    expect(state.role).toBeUndefined();
    expect(state.ownerId).toBeUndefined();
    expect(state.isOwner).toBeUndefined();
    expect(state.activeManagementId).toBe(DEFAULT_MANAGEMENT_ID);
  });
});
