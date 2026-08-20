import { describe, expect, it } from "vitest";
import { mapRole } from "@/lib/authRole";

describe("mapRole", () => {
  it("maps tenant role names straight through", () => {
    expect(mapRole("admin")).toBe("admin");
    expect(mapRole("mgmt")).toBe("mgmt");
    expect(mapRole("sales")).toBe("sales");
  });

  it("maps platform super-admin names to super_admin", () => {
    expect(mapRole("SuperAdmin")).toBe("super_admin");
    expect(mapRole("super_admin")).toBe("super_admin");
  });

  it("falls back to mgmt (least privilege) for unknown/null", () => {
    expect(mapRole("custom_role")).toBe("mgmt");
    expect(mapRole(null)).toBe("mgmt");
    expect(mapRole(undefined)).toBe("mgmt");
  });
});
