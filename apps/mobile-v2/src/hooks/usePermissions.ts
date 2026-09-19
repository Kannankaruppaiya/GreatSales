import { useCurrentUser } from './useAuthUser';
import type { PermissionKey } from '../domain/types';

/**
 * What the signed-in user may do, as the SERVER resolved it.
 *
 * The previous version reimplemented RBAC here: it branched on
 * `user.role === 'admin' || user.role === 'super_admin'` and returned a
 * hand-written list of permission strings for each role. Three things were
 * wrong with it. It read `role` off a type that has none. Its permission names
 * were invented rather than taken from packages/shared/src/rbac.ts, so a custom
 * role a tenant defines was invisible to it. And it duplicated an authorization
 * decision, which drifts from the server's by definition.
 *
 * AuthUser carries `permissions`: the caller's resolved keys, which is what
 * /auth/me computes from the role's grants. Its schema states the contract -
 * "the web uses these to decide which controls to render; the server still
 * enforces every one of them independently, so hiding a button is a courtesy,
 * never a control" (AGENTS.md §7). This hook is that courtesy and nothing more.
 */
export function usePermissions() {
  const { data: user } = useCurrentUser();
  const granted = user?.permissions;

  const can = (permission: PermissionKey): boolean =>
    granted?.includes(permission) ?? false;

  return { can, role: user?.role ?? null, permissions: granted ?? [] };
}
