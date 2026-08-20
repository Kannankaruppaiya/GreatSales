import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { useAuthRole } from "@/store/auth";
import { useMockOwnerId } from "@/lib/mockOwner";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { EditUserModal } from "@/features/users/EditUserModal";
import { useUsers, useUpdateUser, flattenUsers } from "@/features/users/queries";
import type { UserRow } from "@/features/users/types";

/**
 * Debounces a fast-changing value (e.g. search input) so downstream effects
 * (e.g. a query key) only settle `delayMs` after the user stops typing.
 * Mirrors the same local hook in ProductsPage.tsx — lift into a shared hook
 * once a third page needs it.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function UsersPage() {
  const role = useAuthRole();
  const ownerId = useMockOwnerId();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [roleId, setRoleId] = useState("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  const canEdit = role === "admin";

  const params = {
    search: debouncedSearch.trim() || undefined,
    roleId: roleId === "ALL" ? undefined : roleId,
  };
  const q = useUsers(params);
  const update = useUpdateUser();

  const users = flattenUsers(q.data);
  const activeCount = users.filter((u) => u.active).length;

  // Role filter options — there is no dedicated roles endpoint, so they are
  // derived from the loaded rows, same pattern as ProductsPage's principals.
  const roleOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const u of users) options.set(u.roleId, u.roleName);
    return [...options.entries()].map(([id, name]) => ({ id, name }));
  }, [users]);

  return (
    <div className="space-y-6">
      {/* Users Management Card */}
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3.5 border-b border-line flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-ink">User management</span>
            <span className="text-xs text-muted font-medium">
              {users.length} users · {activeCount} active
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-brand focus:border-brand w-56"
            />

            {roleOptions.length > 0 && (
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="h-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink focus:outline-brand focus:border-brand"
              >
                <option value="ALL">All roles</option>
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}

            <Button size="sm" variant="outline" onClick={() => q.refetch()}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", q.isFetching && "animate-spin")} />
              Refresh
            </Button>

            {canEdit && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> + Add user
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[50vh]">
          <QueryBoundary
            isLoading={q.isLoading}
            isError={q.isError}
            error={q.error}
            isEmpty={users.length === 0}
            emptyLabel="No users match your search."
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  {canEdit && <th className="py-2.5 px-3 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {users.map((u) => {
                  const isCurrent = u.id === ownerId;

                  return (
                    <tr key={u.id} className="hover:bg-surface-2/60 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-ink">
                        {u.name} {isCurrent && <span className="text-[11px] text-brand font-normal">(you)</span>}
                      </td>
                      <td className="py-2.5 px-3 text-muted">{u.username || "—"}</td>
                      <td className="py-2.5 px-3 text-muted">{u.email}</td>
                      <td className="py-2.5 px-3">
                        <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-surface-2 text-ink border border-line">
                          {u.roleName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-bold",
                            u.active ? "bg-brand-soft text-brand-ink" : "bg-red-soft text-red"
                          )}
                        >
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditUser(u)}
                              className="text-brand hover:underline font-bold text-xs cursor-pointer"
                            >
                              Edit
                            </button>
                            {!isCurrent && (
                              <>
                                <span className="text-muted">·</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    update.mutate({ id: u.id, patch: { active: !u.active } })
                                  }
                                  className="text-muted hover:underline text-xs cursor-pointer"
                                >
                                  {u.active ? "Deactivate" : "Activate"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
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
              onClick={() => q.fetchNextPage()}
              disabled={q.isFetchingNextPage}
            >
              {q.isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Load more
            </Button>
          </div>
        )}

        {update.isError && (
          <div className="px-3.5 pb-3 text-[11px] font-medium text-red">
            {update.error instanceof ApiError ? update.error.message : "Failed to update user."}
          </div>
        )}
      </Card>

      {/* Role Permissions Matrix Card */}
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3.5 border-b border-line flex items-center justify-between">
          <div className="font-bold text-sm text-ink">Role permissions reference</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line">
              <tr>
                <th className="py-2.5 px-3 min-w-[180px]">Module</th>
                <th className="py-2.5 px-3">Administrator</th>
                <th className="py-2.5 px-3">Salesperson</th>
                <th className="py-2.5 px-3">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              <tr className="hover:bg-surface-2/60">
                <td className="py-2.5 px-3 font-bold text-ink">Projections & follow-ups</td>
                <td className="py-2.5 px-3 text-muted">Full — all salespersons</td>
                <td className="py-2.5 px-3 text-muted">Create / edit own only</td>
                <td className="py-2.5 px-3 text-muted">View all (read-only)</td>
              </tr>
              <tr className="hover:bg-surface-2/60">
                <td className="py-2.5 px-3 font-bold text-ink">Customers</td>
                <td className="py-2.5 px-3 text-muted">Full + reassign</td>
                <td className="py-2.5 px-3 text-muted">Add & view own</td>
                <td className="py-2.5 px-3 text-muted">View all</td>
              </tr>
              <tr className="hover:bg-surface-2/60">
                <td className="py-2.5 px-3 font-bold text-ink">Products & principals</td>
                <td className="py-2.5 px-3 text-muted">Full</td>
                <td className="py-2.5 px-3 text-muted">View (via worksheet)</td>
                <td className="py-2.5 px-3 text-muted">—</td>
              </tr>
              <tr className="hover:bg-surface-2/60">
                <td className="py-2.5 px-3 font-bold text-ink">Users & roles</td>
                <td className="py-2.5 px-3 text-muted">Full</td>
                <td className="py-2.5 px-3 text-muted">—</td>
                <td className="py-2.5 px-3 text-muted">—</td>
              </tr>
              <tr className="hover:bg-surface-2/60">
                <td className="py-2.5 px-3 font-bold text-ink">Dashboards & export</td>
                <td className="py-2.5 px-3 text-muted">All data</td>
                <td className="py-2.5 px-3 text-muted">Own data</td>
                <td className="py-2.5 px-3 text-muted">All data</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
      {addOpen && (
        <EditUserModal
          open
          onClose={() => setAddOpen(false)}
          user={null}
          roleOptions={roleOptions}
        />
      )}

      {editUser && (
        <EditUserModal
          open={!!editUser}
          onClose={() => setEditUser(null)}
          user={editUser}
          roleOptions={roleOptions}
        />
      )}
    </div>
  );
}
