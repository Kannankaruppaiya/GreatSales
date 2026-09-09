import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, RefreshCw } from "lucide-react";
import { useCurrentUserId, useHasPermission } from "@/store/auth";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { UserFormModal } from "@/features/users/modals/UserFormModal";
import { ResetPasswordModal } from "@/features/users/modals/ResetPasswordModal";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
import {
  flattenUsers,
  useDeleteUser,
  useRestoreUser,
  useRoles,
  useTeams,
  useUpdateUser,
  useUsers,
  userTotal,
} from "@/features/users/queries";
import {
  PERM_USER_MANAGE,
  type SortDirection,
  type UserRow,
  type UserSortField,
  type UserStatusFilter,
} from "@/features/users/types";

/** Debounces a fast-changing value so a query key settles after typing stops. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Which row action is awaiting confirmation. */
type PendingAction =
  | { kind: "deactivate" | "activate" | "delete" | "restore"; user: UserRow }
  | null;

const SORTABLE: { field: UserSortField; label: string }[] = [
  { field: "name", label: "Name" },
  { field: "username", label: "Username" },
  { field: "email", label: "Email" },
];

export function UsersTab() {
  const currentUserId = useCurrentUserId();
  // Permission-driven, not role-name-driven. `role === "admin"` hid every
  // action from a super_admin, and would hide them from any custom role a
  // tenant creates with user.manage.
  const canManage = useHasPermission(PERM_USER_MANAGE);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [roleId, setRoleId] = useState("ALL");
  const [teamId, setTeamId] = useState("ALL");
  const [status, setStatus] = useState<UserStatusFilter>("all");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [sort, setSort] = useState<UserSortField>("name");
  const [dir, setDir] = useState<SortDirection>("asc");

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);

  const params = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      roleId: roleId === "ALL" ? undefined : roleId,
      teamId: teamId === "ALL" ? undefined : teamId,
      status,
      sort,
      dir,
      includeDeleted,
    }),
    [debouncedSearch, roleId, teamId, status, sort, dir, includeDeleted],
  );

  const q = useUsers(params, { enabled: canManage });
  const roles = useRoles({ enabled: canManage });
  const teams = useTeams({ enabled: canManage });
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const restore = useRestoreUser();

  const users = flattenUsers(q.data);
  // The SERVER's count. `users.length` counts only loaded pages, so it would
  // under-report the moment the list paginated.
  const total = userTotal(q.data);

  const toggleSort = (field: UserSortField) => {
    if (sort === field) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setDir("asc");
    }
  };

  /**
   * Runs the confirmed action. Each of these is refused server-side for your
   * own account and for the last administrator, and the resulting message is
   * rendered verbatim in the dialog rather than swallowed.
   */
  const runPending = async () => {
    if (!pending) return;
    try {
      if (pending.kind === "deactivate")
        await update.mutateAsync({
          id: pending.user.id,
          patch: { active: false },
        });
      else if (pending.kind === "activate")
        await update.mutateAsync({
          id: pending.user.id,
          patch: { active: true },
        });
      else if (pending.kind === "delete") await remove.mutateAsync(pending.user.id);
      else await restore.mutateAsync(pending.user.id);
      setPending(null);
    } catch {
      // Kept open so the server's reason is readable.
    }
  };

  const actionMutation =
    pending?.kind === "delete"
      ? remove
      : pending?.kind === "restore"
        ? restore
        : update;

  if (!canManage) {
    return (
      <Card className="p-8 text-center border-line">
        <p className="text-sm font-bold text-ink">
          You do not have permission to manage users
        </p>
        <p className="text-xs text-muted mt-1.5">
          Ask an administrator for the “Manage users” permission.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3.5 border-b border-line flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-ink">User management</span>
            <span className="text-xs text-muted font-medium">
              {total} {total === 1 ? "user" : "users"}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              aria-label="Search users"
              className="h-8.5 w-48 rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-muted/60 transition-all hover:border-muted/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs"
            />

            <select
              aria-label="Filter by role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="h-8.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-all hover:border-muted/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs cursor-pointer"
            >
              <option value="ALL">All roles</option>
              {(roles.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="h-8.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-all hover:border-muted/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs cursor-pointer"
            >
              <option value="ALL">All teams</option>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatusFilter)}
              className="h-8.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-all hover:border-muted/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs cursor-pointer"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>

            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-brand cursor-pointer"
              />
              Show deleted
            </label>

            <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
              <RefreshCw
                className={cn("h-3.5 w-3.5 mr-1", q.isFetching && "animate-spin")}
              />
              Refresh
            </Button>

            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add user
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[60vh]">
          <QueryBoundary
            isLoading={q.isLoading}
            isError={q.isError}
            error={q.error}
            isEmpty={users.length === 0}
            emptyLabel={
              debouncedSearch || roleId !== "ALL" || teamId !== "ALL" || status !== "all"
                ? "No users match those filters. Try clearing one."
                : "No users yet. Add the first one."
            }
          >
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">
                Users in this workspace, with their role, team, manager, and
                status
              </caption>
              <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs whitespace-nowrap">
                <tr>
                  {SORTABLE.map(({ field, label }) => (
                    <th
                      key={field}
                      scope="col"
                      className="py-2.5 px-3"
                      aria-sort={
                        sort === field
                          ? dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(field)}
                        className="inline-flex items-center gap-1 hover:text-ink cursor-pointer uppercase"
                      >
                        {label}
                        {sort === field &&
                          (dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          ))}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="py-2.5 px-3">
                    Role
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Team
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Manager
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Last login
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-center">
                    Status
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {users.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const isDeleted = !!u.deletedAt;

                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        "hover:bg-surface-2/60 transition-colors",
                        isDeleted && "opacity-60",
                      )}
                    >
                      <td className="py-2.5 px-3 font-bold text-ink">
                        {u.name}{" "}
                        {isSelf && (
                          <span className="text-[11px] text-brand font-normal">
                            (you)
                          </span>
                        )}
                        {isDeleted && (
                          <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-soft text-red">
                            Deleted
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted">{u.username}</td>
                      <td className="py-2.5 px-3 text-muted">{u.email}</td>
                      <td className="py-2.5 px-3">
                        <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-surface-2 text-ink border border-line">
                          {u.roleName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted">
                        {u.teamName ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 text-muted">
                        {u.managerName ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 text-muted">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-bold",
                            u.active
                              ? "bg-brand-soft text-brand-ink"
                              : "bg-red-soft text-red",
                          )}
                        >
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          {isDeleted ? (
                            <button
                              type="button"
                              onClick={() => setPending({ kind: "restore", user: u })}
                              className="text-brand hover:underline font-bold text-xs cursor-pointer"
                            >
                              Restore
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditUser(u)}
                                className="text-brand hover:underline font-bold text-xs cursor-pointer"
                              >
                                Edit
                              </button>
                              {isSelf ? (
                                // The server refuses all three on your own
                                // account. Saying so beats an unexplained gap.
                                <span
                                  className="text-[11px] text-muted"
                                  title="You cannot deactivate, delete, or reset your own account. Ask another administrator."
                                >
                                  · your account
                                </span>
                              ) : (
                                <>
                                  <span className="text-muted">·</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPending({
                                        kind: u.active ? "deactivate" : "activate",
                                        user: u,
                                      })
                                    }
                                    className="text-muted hover:underline text-xs cursor-pointer"
                                  >
                                    {u.active ? "Deactivate" : "Activate"}
                                  </button>
                                  <span className="text-muted">·</span>
                                  <button
                                    type="button"
                                    onClick={() => setResetUser(u)}
                                    className="text-muted hover:underline text-xs cursor-pointer"
                                  >
                                    Reset password
                                  </button>
                                  <span className="text-muted">·</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPending({ kind: "delete", user: u })
                                    }
                                    className="text-red hover:underline text-xs cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </QueryBoundary>
        </div>

        {q.hasNextPage && (
          <div className="p-3 border-t border-line flex justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void q.fetchNextPage()}
              disabled={q.isFetchingNextPage}
            >
              {q.isFetchingNextPage && (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              )}
              Load more
            </Button>
          </div>
        )}

        {update.isError && !pending && (
          <p
            role="alert"
            className="px-3.5 pb-3 text-[11px] font-medium text-red"
          >
            {update.error instanceof ApiError
              ? update.error.message
              : "Failed to update user."}
          </p>
        )}
      </Card>

      {addOpen && (
        <UserFormModal open onClose={() => setAddOpen(false)} user={null} />
      )}

      {editUser && (
        // Keyed so switching straight from one user to another remounts with
        // that user's values instead of keeping the previous one's.
        <UserFormModal
          key={editUser.id}
          open
          onClose={() => setEditUser(null)}
          user={editUser}
        />
      )}

      {resetUser && (
        <ResetPasswordModal
          key={resetUser.id}
          open
          onClose={() => setResetUser(null)}
          user={resetUser}
        />
      )}

      {pending && (
        <ConfirmActionModal
          open
          onClose={() => setPending(null)}
          onConfirm={() => void runPending()}
          destructive={pending.kind === "deactivate" || pending.kind === "delete"}
          pending={actionMutation.isPending}
          error={actionMutation.error}
          title={
            {
              deactivate: "Deactivate user",
              activate: "Activate user",
              delete: "Delete user",
              restore: "Restore user",
            }[pending.kind]
          }
          confirmLabel={
            {
              deactivate: "Deactivate",
              activate: "Activate",
              delete: "Delete",
              restore: "Restore",
            }[pending.kind]
          }
          body={
            pending.kind === "deactivate" ? (
              <>
                <strong>{pending.user.name}</strong> will be signed out of every
                device immediately and will not be able to sign in again until
                you reactivate them.
              </>
            ) : pending.kind === "activate" ? (
              <>
                <strong>{pending.user.name}</strong> will be able to sign in
                again with their existing password.
              </>
            ) : pending.kind === "delete" ? (
              <>
                <strong>{pending.user.name}</strong> will be signed out of every
                device and removed from every list. Their email and username
                become free for someone else to use. You can restore them later
                — unless that identity has been taken in the meantime.
              </>
            ) : (
              <>
                <strong>{pending.user.name}</strong> will reappear in the user
                list. This fails if their email or username has been taken by
                someone else since they were deleted.
              </>
            )
          }
        />
      )}
    </>
  );
}
