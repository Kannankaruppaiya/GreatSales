import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { roleLabel } from "@/data/constants";
import { useTrackerStore } from "@/store/trackerStore";
import { useAuthRole } from "@/store/auth";
import { useMockOwnerId } from "@/lib/mockOwner";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { EditUserModal } from "@/features/users/EditUserModal";
import { ReassignCustomersModal } from "@/features/customers/ReassignCustomersModal";
import type { User } from "@/data/types";

export default function UsersPage() {
  const role = useAuthRole();
  const ownerId = useMockOwnerId();
  const { users, customers, toggleUserActive } = useTrackerStore();

  const [editUser, setEditUser] = useState<User | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [assignUser, setAssignUser] = useState<User | null>(null);

  const canEdit = role === "admin";

  const custCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    customers.forEach((c) => {
      counts[c.ownerId] = (counts[c.ownerId] || 0) + 1;
    });
    return counts;
  }, [customers]);

  const activeCount = users.filter((u) => u.active).length;

  return (
    <div className="space-y-6">
      {/* 1. Users Management Card */}
      <Card className="p-0 overflow-hidden shadow-xs border-line">
        <div className="p-3.5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-ink">User management</span>
            <span className="text-xs text-muted font-medium">
              {users.length} users · {activeCount} active
            </span>
          </div>

          {canEdit && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> + Add user
            </Button>
          )}
        </div>

        <div className="overflow-x-auto max-h-[50vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted sticky top-0 z-10 border-b border-line shadow-2xs">
              <tr>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3 text-right">Customers</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                {canEdit && <th className="py-2.5 px-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {users.map((u) => {
                const cCount = custCounts[u.id] || 0;
                const isCurrent = u.id === ownerId;

                return (
                  <tr key={u.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-ink">
                      {u.name} {isCurrent && <span className="text-[11px] text-brand font-normal">(you)</span>}
                    </td>
                    <td className="py-2.5 px-3 text-muted">{u.username || "—"}</td>
                    <td className="py-2.5 px-3">
                      <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-surface-2 text-ink border border-line">
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-ink">
                      {u.role === "sales" ? cCount : "—"}
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
                          {u.role === "sales" && (
                            <>
                              <span className="text-muted">·</span>
                              <button
                                type="button"
                                onClick={() => setAssignUser(u)}
                                className="text-blue hover:underline font-bold text-xs cursor-pointer"
                              >
                                Assign customers
                              </button>
                            </>
                          )}
                          {!isCurrent && (
                            <>
                              <span className="text-muted">·</span>
                              <button
                                type="button"
                                onClick={() => toggleUserActive(u.id)}
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
        </div>
      </Card>

      {/* 2. Role Permissions Matrix Card */}
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
      {addOpen && <EditUserModal open onClose={() => setAddOpen(false)} user={null} />}

      {editUser && (
        <EditUserModal open={!!editUser} onClose={() => setEditUser(null)} user={editUser} />
      )}

      {assignUser && (
        <ReassignCustomersModal
          open={!!assignUser}
          onClose={() => setAssignUser(null)}
          initialTargetUser={assignUser}
        />
      )}
    </div>
  );
}
