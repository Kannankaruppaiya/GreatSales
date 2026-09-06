import { useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { useHasPermission } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
import {
  useCreateRole,
  useDeleteRole,
  usePermissionCatalog,
  useRoles,
  useUpdateRole,
} from "@/features/users/queries";
import {
  PERM_ROLE_MANAGE,
  PERM_USER_MANAGE,
  type RoleRow,
} from "@/features/users/types";

/**
 * Roles and their permissions, as a live matrix.
 *
 * This replaces a hardcoded reference table that had no relationship to actual
 * grants — it was free to lie about what each role could do, and did. Every
 * checkbox here reflects a real RolePermission row, and toggling one writes
 * the full new grant set back.
 *
 * The permissions that keep a workspace administrable — "Manage users" and
 * "Manage roles" — cannot be removed from the last populated role that grants
 * them. That is enforced server-side; the tooltip here only explains the
 * refusal before it happens.
 */
const ADMIN_PERMISSIONS = new Set([PERM_USER_MANAGE, PERM_ROLE_MANAGE]);

export function RolesTab() {
  // Both called unconditionally: `a || useHook()` would short-circuit and
  // skip a hook, which breaks the rules of hooks the moment canEdit flips.
  const canEdit = useHasPermission(PERM_ROLE_MANAGE);
  const canManageUsers = useHasPermission(PERM_USER_MANAGE);
  // The user editor needs role NAMES for its dropdown, so user.manage is
  // enough to read the matrix; only role.manage may change it.
  const canRead = canEdit || canManageUsers;

  const roles = useRoles({ enabled: canRead });
  const catalog = usePermissionCatalog({ enabled: canRead });
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKeys, setNewKeys] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<RoleRow | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(
    null,
  );

  const roleList = roles.data ?? [];
  const groups = catalog.data ?? [];

  /**
   * How many OTHER roles with at least one user still grant this permission.
   * Zero means the server will refuse to remove it here.
   */
  const otherHoldersOf = (permission: string, exceptRoleId: string) =>
    roleList.filter(
      (r) =>
        r.id !== exceptRoleId &&
        r.userCount > 0 &&
        r.permissionKeys.includes(permission),
    ).length;

  const togglePermission = async (role: RoleRow, key: string) => {
    const has = role.permissionKeys.includes(key);
    const next = has
      ? role.permissionKeys.filter((k) => k !== key)
      : [...role.permissionKeys, key];

    setRowError(null);
    try {
      await updateRole.mutateAsync({ id: role.id, patch: { permissionKeys: next } });
    } catch (e) {
      setRowError({
        id: role.id,
        message:
          e instanceof ApiError ? e.message : "Could not change that permission.",
      });
    }
  };

  if (!canRead) {
    return (
      <Card className="p-8 text-center border-line">
        <p className="text-sm font-bold text-ink">
          You do not have permission to view roles
        </p>
        <p className="text-xs text-muted mt-1.5">
          Ask an administrator for the “Manage roles” permission.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3.5 border-b border-line flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span className="font-bold text-sm text-ink">
              Roles &amp; permissions
            </span>
            <p className="text-[11px] text-muted mt-0.5">
              {canEdit
                ? "Tick a permission to grant it. Changes sign out everyone holding that role."
                : "Read-only — you can see what each role allows but not change it."}
            </p>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add role
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <QueryBoundary
            isLoading={roles.isLoading || catalog.isLoading}
            isError={roles.isError || catalog.isError}
            error={roles.error ?? catalog.error}
            isEmpty={roleList.length === 0}
            emptyLabel="No roles yet."
          >
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">
                Which permissions each role grants
              </caption>
              <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line whitespace-nowrap">
                <tr>
                  <th scope="col" className="py-2.5 px-3 min-w-[160px]">
                    Role
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-center">
                    Users
                  </th>
                  {groups.map((group) =>
                    group.permissions.map((p) => (
                      <th
                        key={p.key}
                        scope="col"
                        className="py-2.5 px-2 text-center align-bottom min-w-[90px]"
                      >
                        <span className="block text-[9px] text-muted/70 font-semibold">
                          {group.module}
                        </span>
                        <span className="block normal-case text-[10px] leading-tight">
                          {p.label}
                        </span>
                      </th>
                    )),
                  )}
                  {canEdit && (
                    <th scope="col" className="py-2.5 px-3 text-center">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {roleList.map((role) => (
                  <tr key={role.id} className="hover:bg-surface-2/60">
                    <th
                      scope="row"
                      className="py-2.5 px-3 font-bold text-ink text-left"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {role.name}
                        {role.isSystem && (
                          <Lock
                            // role="img" is what exposes aria-label on an SVG.
                            // Without it the label is invisible to a screen
                            // reader and the lock means nothing to them.
                            role="img"
                            className="h-3 w-3 text-muted"
                            aria-label="Built-in role — cannot be renamed or deleted"
                          />
                        )}
                      </span>
                      {rowError?.id === role.id && (
                        <p
                          role="alert"
                          className="text-[10.5px] font-medium text-red mt-1 normal-case"
                        >
                          {rowError.message}
                        </p>
                      )}
                    </th>
                    <td className="py-2.5 px-3 text-center text-muted">
                      {role.userCount}
                    </td>

                    {groups.map((group) =>
                      group.permissions.map((p) => {
                        const granted = role.permissionKeys.includes(p.key);
                        const isLastHolder =
                          granted &&
                          ADMIN_PERMISSIONS.has(p.key) &&
                          otherHoldersOf(p.key, role.id) === 0;

                        return (
                          <td key={p.key} className="py-2.5 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={granted}
                              disabled={
                                !canEdit || isLastHolder || updateRole.isPending
                              }
                              aria-label={`${p.label} for ${role.name}`}
                              title={
                                isLastHolder
                                  ? `This is the last role with users that can "${p.label}". Give another role that permission first.`
                                  : undefined
                              }
                              onChange={() => void togglePermission(role, p.key)}
                              className="h-3.5 w-3.5 rounded accent-brand disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            />
                          </td>
                        );
                      }),
                    )}

                    {canEdit && (
                      <td className="py-2.5 px-3 text-center">
                        {!role.isSystem && (
                          <button
                            type="button"
                            aria-label={`Delete role ${role.name}`}
                            onClick={() => setPendingDelete(role)}
                            className="text-red hover:opacity-70 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </QueryBoundary>
        </div>
      </Card>

      {addOpen && (
        <ConfirmActionModal
          open
          onClose={() => {
            setAddOpen(false);
            setNewName("");
            setNewKeys([]);
            createRole.reset();
          }}
          onConfirm={() => {
            void createRole
              .mutateAsync({ name: newName.trim(), permissionKeys: newKeys })
              .then(() => {
                setAddOpen(false);
                setNewName("");
                setNewKeys([]);
              })
              .catch(() => undefined);
          }}
          title="Add role"
          confirmLabel="Create role"
          pending={createRole.isPending}
          error={createRole.error}
          body={
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="role-name"
                  className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
                >
                  Role name *
                </label>
                <Input
                  id="role-name"
                  value={newName}
                  placeholder="e.g. Regional head"
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Permissions * (at least one)
                </legend>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-line p-2 space-y-2">
                  {groups.map((group) => (
                    <div key={group.module}>
                      <p className="text-[10px] font-bold uppercase text-muted/70">
                        {group.module}
                      </p>
                      {group.permissions.map((p) => (
                        <label
                          key={p.key}
                          className="flex items-center gap-2 text-[11.5px] text-ink cursor-pointer py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={newKeys.includes(p.key)}
                            onChange={(e) =>
                              setNewKeys((keys) =>
                                e.target.checked
                                  ? [...keys, p.key]
                                  : keys.filter((k) => k !== p.key),
                              )
                            }
                            className="h-3.5 w-3.5 rounded accent-brand cursor-pointer"
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>
          }
        />
      )}

      {pendingDelete && (
        <ConfirmActionModal
          open
          destructive
          onClose={() => {
            setPendingDelete(null);
            deleteRole.reset();
          }}
          onConfirm={() => {
            void deleteRole
              .mutateAsync(pendingDelete.id)
              .then(() => setPendingDelete(null))
              .catch(() => undefined);
          }}
          title="Delete role"
          confirmLabel="Delete role"
          pending={deleteRole.isPending}
          error={deleteRole.error}
          body={
            <>
              Delete the role <strong>{pendingDelete.name}</strong>? This cannot
              be undone. It will fail if anyone is still assigned to it.
            </>
          }
        />
      )}
    </>
  );
}
