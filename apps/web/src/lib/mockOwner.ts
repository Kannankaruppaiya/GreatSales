/**
 * Mock-data owner resolver. The mock pages (dashboard/leads/orders/etc.) still
 * filter seed data by a mock user id ("owner"). Real session role now comes from
 * useAuth; this maps that role to a representative mock user id so those pages keep
 * working until Phase 1 rewires each to the real API. Delete once no mock page
 * depends on a mock ownerId.
 */
import { users } from "@/data/mock";
import type { Role } from "@/data/constants";
import { useAuthRole } from "@/store/auth";

export function defaultOwnerFor(role: Role): string {
  if (role === "sales") {
    return users.find((u) => u.role === "sales")?.id ?? "u_s1";
  }
  if (role === "mgmt") {
    return (
      users.find((u) => u.role === "mgmt")?.id ??
      users.find((u) => u.role === "admin")?.id ??
      "u_adm"
    );
  }
  const match = users.find(
    (u) => u.role === role || (role === "super_admin" && u.role === "admin"),
  );
  if (match) return match.id;
  return users[0]?.id ?? "u_adm";
}

/** Mock owner id derived from the real session role. */
export function useMockOwnerId(): string {
  return defaultOwnerFor(useAuthRole());
}
