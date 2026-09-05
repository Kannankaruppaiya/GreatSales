import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useHasPermission } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { Button, Card, Input, Select } from "@/components/ui";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { ConfirmActionModal } from "@/components/modals/ConfirmActionModal";
import {
  flattenUsers,
  useAddTeamMembers,
  useCreateTeam,
  useDeleteTeam,
  useRemoveTeamMember,
  useTeamMembers,
  useTeams,
  useUpdateTeam,
  useUsers,
} from "@/features/users/queries";
import { PERM_USER_MANAGE, type TeamRow } from "@/features/users/types";

/**
 * Teams: who reports into which group, and who runs it.
 *
 * Deleting a team unassigns its members rather than deleting them — stated
 * plainly in the confirmation, because "delete team" reads as though it might
 * take the people with it.
 */
export function TeamsTab() {
  const canManage = useHasPermission(PERM_USER_MANAGE);

  const teams = useTeams({ enabled: canManage });
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newManagerId, setNewManagerId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TeamRow | null>(null);
  const [editing, setEditing] = useState<TeamRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editManagerId, setEditManagerId] = useState("");

  // Managers must be active users; the server refuses anyone else, so offering
  // them would only produce an avoidable error.
  const candidates = useUsers(
    { status: "active", sort: "name" },
    { enabled: canManage },
  );
  const activeUsers = flattenUsers(candidates.data);

  if (!canManage) {
    return (
      <Card className="p-8 text-center border-line">
        <p className="text-sm font-bold text-ink">
          You do not have permission to manage teams
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
        <div className="p-3.5 border-b border-line flex items-center justify-between gap-2">
          <div>
            <span className="font-bold text-sm text-ink">Teams</span>
            <p className="text-[11px] text-muted mt-0.5">
              Expand a team to see and change who is on it.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add team
          </Button>
        </div>

        <div className="overflow-x-auto">
          <QueryBoundary
            isLoading={teams.isLoading}
            isError={teams.isError}
            error={teams.error}
            isEmpty={(teams.data ?? []).length === 0}
            emptyLabel="No teams yet. Create your first team to group salespeople under a manager."
          >
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">
                Teams, their managers, and how many people are on each
              </caption>
              <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line">
                <tr>
                  <th scope="col" className="py-2.5 px-3">
                    Team
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Manager
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-center">
                    Members
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {(teams.data ?? []).map((team) => (
                  <TeamRowView
                    key={team.id}
                    team={team}
                    expanded={expandedId === team.id}
                    activeUsers={activeUsers}
                    onToggle={() =>
                      setExpandedId((id) => (id === team.id ? null : team.id))
                    }
                    onEdit={() => {
                      setEditing(team);
                      setEditName(team.name);
                      setEditManagerId(team.managerId);
                    }}
                    onDelete={() => setPendingDelete(team)}
                  />
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
            setNewManagerId("");
            createTeam.reset();
          }}
          onConfirm={() => {
            void createTeam
              .mutateAsync({ name: newName.trim(), managerId: newManagerId })
              .then(() => {
                setAddOpen(false);
                setNewName("");
                setNewManagerId("");
              })
              .catch(() => undefined);
          }}
          title="Add team"
          confirmLabel="Create team"
          pending={createTeam.isPending}
          error={createTeam.error}
          body={
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="team-name"
                  className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
                >
                  Team name *
                </label>
                <Input
                  id="team-name"
                  value={newName}
                  placeholder="e.g. Northern Region"
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="team-manager"
                  className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
                >
                  Manager *
                </label>
                <Select
                  id="team-manager"
                  value={newManagerId}
                  onChange={(e) => setNewManagerId(e.target.value)}
                >
                  <option value="">Choose a manager…</option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          }
        />
      )}

      {editing && (
        <ConfirmActionModal
          open
          onClose={() => {
            setEditing(null);
            updateTeam.reset();
          }}
          onConfirm={() => {
            void updateTeam
              .mutateAsync({
                id: editing.id,
                patch: { name: editName.trim(), managerId: editManagerId },
              })
              .then(() => setEditing(null))
              .catch(() => undefined);
          }}
          title={`Edit ${editing.name}`}
          confirmLabel="Save changes"
          pending={updateTeam.isPending}
          error={updateTeam.error}
          body={
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="team-edit-name"
                  className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
                >
                  Team name
                </label>
                <Input
                  id="team-edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="team-edit-manager"
                  className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
                >
                  Manager
                </label>
                <Select
                  id="team-edit-manager"
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                >
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>
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
            deleteTeam.reset();
          }}
          onConfirm={() => {
            void deleteTeam
              .mutateAsync(pendingDelete.id)
              .then(() => setPendingDelete(null))
              .catch(() => undefined);
          }}
          title="Delete team"
          confirmLabel="Delete team"
          pending={deleteTeam.isPending}
          error={deleteTeam.error}
          body={
            <>
              Delete <strong>{pendingDelete.name}</strong>? Its{" "}
              {pendingDelete.memberCount} member
              {pendingDelete.memberCount === 1 ? "" : "s"} will be unassigned
              from any team. <strong>Nobody is deleted</strong> — they keep
              their accounts and everything else.
            </>
          }
        />
      )}
    </>
  );
}

/** One team row, plus its expandable membership panel. */
function TeamRowView({
  team,
  expanded,
  activeUsers,
  onToggle,
  onEdit,
  onDelete,
}: {
  team: TeamRow;
  expanded: boolean;
  activeUsers: { id: string; name: string; teamId: string | null }[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Only fetched while the row is open, so a workspace with many teams does
  // not issue one member query per team on first render.
  const members = useTeamMembers(expanded ? team.id : null);
  const addMembers = useAddTeamMembers();
  const removeMember = useRemoveTeamMember();
  const [pick, setPick] = useState("");

  const candidates = activeUsers.filter((u) => u.teamId !== team.id);

  return (
    <>
      <tr className="hover:bg-surface-2/60">
        <td className="py-2.5 px-3 font-bold text-ink">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 cursor-pointer hover:text-brand"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            {team.name}
          </button>
        </td>
        <td className="py-2.5 px-3 text-muted">{team.managerName}</td>
        <td className="py-2.5 px-3 text-center text-muted">
          {team.memberCount}
        </td>
        <td className="py-2.5 px-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="text-brand hover:underline font-bold text-xs cursor-pointer"
            >
              Edit
            </button>
            <span className="text-muted">·</span>
            <button
              type="button"
              aria-label={`Delete team ${team.name}`}
              onClick={onDelete}
              className="text-red hover:opacity-70 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={4} className="bg-surface-2/40 px-6 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Select
                aria-label={`Add a member to ${team.name}`}
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="text-xs w-56"
              >
                <option value="">Add a member…</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!pick || addMembers.isPending}
                onClick={() => {
                  void addMembers
                    .mutateAsync({ teamId: team.id, userIds: [pick] })
                    .then(() => setPick(""))
                    .catch(() => undefined);
                }}
              >
                Add
              </Button>
              {addMembers.isError && (
                <span role="alert" className="text-[11px] font-medium text-red">
                  {addMembers.error instanceof ApiError
                    ? addMembers.error.message
                    : "Could not add that member."}
                </span>
              )}
            </div>

            {members.isLoading ? (
              <p className="text-[11px] text-muted">Loading members…</p>
            ) : (members.data ?? []).length === 0 ? (
              <p className="text-[11px] text-muted">
                Nobody is on this team yet.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {(members.data ?? []).map((m) => (
                  <li
                    key={m.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink"
                  >
                    {m.name}
                    <button
                      type="button"
                      aria-label={`Remove ${m.name} from ${team.name}`}
                      disabled={removeMember.isPending}
                      onClick={() => {
                        void removeMember
                          .mutateAsync({ teamId: team.id, userId: m.id })
                          .catch(() => undefined);
                      }}
                      className="text-muted hover:text-red cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
