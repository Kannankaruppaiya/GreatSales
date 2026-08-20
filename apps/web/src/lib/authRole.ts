/**
 * Backend role name (user.role = role.name) → web Role. The tenant layer only
 * issues admin/mgmt/sales; "SuperAdmin" comes from the platform layer (Phase 0.5).
 * Unknown/custom role names fall back to mgmt (least privilege among web roles).
 */
import type { Role } from "../data/constants";

export function mapRole(name: string | null | undefined): Role {
  switch (name) {
    case "admin":
      return "admin";
    case "sales":
      return "sales";
    case "SuperAdmin":
    case "super_admin":
      return "super_admin";
    case "mgmt":
    default:
      return "mgmt";
  }
}
