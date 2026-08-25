import { useMemo, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  useCreateUser,
  useRoles,
  useTeams,
  useUpdateUser,
  useUsers,
  flattenUsers,
} from "@/features/users/queries";
import { PasswordField } from "@/features/users/PasswordField";
import type { UserRow } from "@/features/users/types";

/**
 * Create or edit one user.
 *
 * Role, manager, and team options come from `/roles`, `/users`, and `/teams` —
 * NOT from the rows currently loaded in the table. Deriving them from loaded
 * rows meant a role with no members could never receive its first one, which
 * made it impossible to onboard anyone into a newly created role.
 *
 * The caller is expected to key this component by `user?.id ?? "new"` so
 * switching straight from editing one person to another remounts with fresh
 * state instead of showing the previous person's values.
 */
export function UserFormModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
}) {
  const isNew = !user;
  const create = useCreateUser();
  const update = useUpdateUser();
  const mutation = isNew ? create : update;

  const roles = useRoles();
  const teams = useTeams();
  // Only ever a page of candidates for the manager picker; a workspace with
  // thousands of users needs a search-as-you-type picker, which is a separate
  // change. Ordering by name keeps the visible set predictable.
  const managerCandidates = useUsers({ status: "active", sort: "name" });

  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(user?.roleId ?? "");
  const [managerId, setManagerId] = useState(user?.managerId ?? "");
  const [teamId, setTeamId] = useState(user?.teamId ?? "");
  const [active, setActive] = useState(user?.active ?? true);
  const [localError, setLocalError] = useState("");

  const roleOptions = roles.data ?? [];
  const teamOptions = teams.data ?? [];
  const managerOptions = useMemo(
    () =>
      flattenUsers(managerCandidates.data)
        // Never offer the user being edited as their own manager: the server
        // refuses it, so showing it would only produce a pointless error.
        .filter((u) => u.id !== user?.id),
    [managerCandidates.data, user?.id],
  );

  const selectedRoleId = roleId || roleOptions[0]?.id || "";

  /** The server's coded failure, mapped to the field it belongs to. */
  const serverCode =
    mutation.error instanceof ApiError ? mutation.error.code : undefined;
  const serverMessage =
    mutation.error instanceof ApiError ? mutation.error.message : undefined;

  const passwordError = serverCode === "WEAK_PASSWORD" ? serverMessage : undefined;
  const identityError =
    serverCode === "DUPLICATE_IDENTITY" ? serverMessage : undefined;
  const managerError =
    serverCode === "INVALID_MANAGER" ? serverMessage : undefined;
  const referenceError =
    serverCode === "INVALID_REFERENCE" ? serverMessage : undefined;
  const unmappedError =
    mutation.isError && !serverCode
      ? (serverMessage ?? "Failed to save user.")
      : undefined;

  const canSubmit =
    !!name.trim() &&
    !!username.trim() &&
    !!email.trim() &&
    !!selectedRoleId &&
    (!isNew || !!password.trim()) &&
    !mutation.isPending;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLocalError("");

    if (!name.trim() || !username.trim() || !email.trim() || !selectedRoleId) {
      setLocalError("Name, username, email and role are all required.");
      return;
    }
    if (isNew && !password.trim()) {
      setLocalError("Choose a password for the new user.");
      return;
    }

    // Sent as typed. The server trims and lower-cases before storing, and it
    // is the only place that normalisation can be relied on.
    const common = {
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      roleId: selectedRoleId,
      managerId: managerId || null,
      teamId: teamId || null,
      active,
    };

    try {
      if (isNew) {
        await create.mutateAsync({ ...common, password: password.trim() });
      } else {
        await update.mutateAsync({
          id: user.id,
          patch: {
            ...common,
            // A blank field means "leave unchanged", never "clear it", so the
            // key is omitted entirely rather than sent empty.
            ...(password.trim() ? { password: password.trim() } : {}),
          },
        });
      }
      onClose();
    } catch {
      // Surfaced inline below from mutation.error.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          {isNew ? (
            <UserPlus className="h-4 w-4 text-brand" />
          ) : (
            <Users className="h-4 w-4 text-brand" />
          )}
          <span>{isNew ? "Add team user" : `Edit user: ${user.name}`}</span>
        </div>
      }
      description={
        isNew
          ? "They will be asked to choose their own password the first time they sign in."
          : "Changing the role or password ends every session this user has open."
      }
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {mutation.isPending
              ? "Saving…"
              : isNew
                ? "Create user"
                : "Save changes"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="uf-name"
            className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
          >
            Full name *
          </label>
          <Input
            id="uf-name"
            required
            placeholder="e.g. Ramesh Kumar"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="uf-username"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
            >
              Username *
            </label>
            <Input
              id="uf-username"
              required
              placeholder="e.g. ramesh"
              value={username}
              aria-invalid={!!identityError}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="uf-email"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
            >
              Email *
            </label>
            <Input
              id="uf-email"
              type="email"
              required
              placeholder="ramesh@greatsales.in"
              value={email}
              aria-invalid={!!identityError}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {identityError && (
          <p role="alert" className="text-[11.5px] font-medium text-red">
            {identityError}
          </p>
        )}

        <PasswordField
          value={password}
          onChange={setPassword}
          identity={{ name, email, username }}
          required={isNew}
          label={isNew ? "Password" : "New password"}
          helpText={
            isNew
              ? undefined
              : "Leave blank to keep the current password. Setting one signs them out everywhere."
          }
          serverError={passwordError}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="uf-role"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
            >
              Access role *
            </label>
            {roles.isLoading ? (
              <p className="text-[11px] text-muted">Loading roles…</p>
            ) : roleOptions.length === 0 ? (
              <p className="text-[11px] text-muted">
                No roles available. Create one on the Roles tab first.
              </p>
            ) : (
              <Select
                id="uf-role"
                value={selectedRoleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <label
              htmlFor="uf-team"
              className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
            >
              Team
            </label>
            <Select
              id="uf-team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">No team</option>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label
            htmlFor="uf-manager"
            className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1"
          >
            Reporting manager
          </label>
          <Select
            id="uf-manager"
            value={managerId}
            aria-invalid={!!managerError}
            onChange={(e) => setManagerId(e.target.value)}
          >
            <option value="">No manager</option>
            {managerOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          {managerError && (
            <p role="alert" className="text-[11.5px] font-medium text-red mt-1">
              {managerError}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-ink pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded accent-brand cursor-pointer"
          />
          Active — can sign in and use GreatSales
        </label>

        {localError && (
          <p role="alert" className="text-xs text-red font-medium">
            {localError}
          </p>
        )}
        {referenceError && (
          <p role="alert" className="text-[11.5px] font-medium text-red">
            {referenceError}
          </p>
        )}
        {unmappedError && (
          <p role="alert" className="text-[11.5px] font-medium text-red">
            {unmappedError}
          </p>
        )}
      </form>
    </Dialog>
  );
}
