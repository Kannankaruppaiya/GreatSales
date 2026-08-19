import { useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { Button, Dialog, Input, Select } from "../ui";
import { ROLES, type Role } from "../../data/constants";
import type { User } from "../../data/types";
import { useTrackerStore } from "../../store/trackerStore";

export function EditUserModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: User | null;
}) {
  const { addUser, updateUser, users } = useTrackerStore();

  const isNew = !user;
  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState(user?.password || "password123");
  const [role, setRole] = useState<Role>(user?.role || "sales");
  const [active, setActive] = useState(user ? user.active : true);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanU = username.trim().toLowerCase();
    if (!name.trim() || !cleanU || !email.trim()) {
      setError("Name, username and email are all required.");
      return;
    }

    if (isNew && users.some((u) => u.username?.toLowerCase() === cleanU)) {
      setError("A user with this username already exists.");
      return;
    }

    if (isNew) {
      addUser({
        name: name.trim(),
        username: cleanU,
        email: email.trim(),
        password,
        role,
        active,
      });
    } else {
      updateUser(user.id, {
        name: name.trim(),
        username: cleanU,
        email: email.trim(),
        password,
        role,
        active,
      });
    }

    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          {isNew ? <UserPlus className="h-4 w-4 text-brand" /> : <Users className="h-4 w-4 text-brand" />}
          <span>{isNew ? "Invite / Add Team User" : `Edit User: ${user.name}`}</span>
        </div>
      }
      description="Configure user credentials, system role, and active status"
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || !username.trim()}>
            {isNew ? "Create User" : "Save Changes"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Full Name *
          </label>
          <Input
            required
            placeholder="e.g. Ramesh Kumar"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Username / Login ID *
            </label>
            <Input
              required
              placeholder="e.g. ramesh"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Email Address *
          </label>
          <Input
            type="email"
            required
            placeholder="ramesh@greatsales.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Access Role *
          </label>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-ink pt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded accent-brand cursor-pointer"
          />
          Active Account (Can login and access GreatSales)
        </label>

        {error && <p className="text-xs text-red font-medium pt-1">{error}</p>}
      </form>
    </Dialog>
  );
}
