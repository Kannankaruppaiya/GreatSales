import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { KeyRound, Users as UsersIcon, UsersRound } from "lucide-react";
import { useHasPermission } from "@/store/auth";
import { cn } from "@/lib/utils";
import { UsersTab } from "@/features/users/tabs/UsersTab";
import { RolesTab } from "@/features/users/tabs/RolesTab";
import { TeamsTab } from "@/features/users/tabs/TeamsTab";
import { PERM_ROLE_MANAGE, PERM_USER_MANAGE } from "@/features/users/types";

/**
 * Team and user governance: users, roles, and teams.
 *
 * The shell owns nothing but which tab is showing; each tab owns its own data
 * and its own permission gate. Tab state lives in the URL rather than in
 * component state, so a refresh, the browser Back button, and a link pasted to
 * a colleague all land in the same place — the previous single-page version
 * lost everything on reload.
 */
export type UsersPageTab = "users" | "roles" | "teams";

const TABS: {
  value: UsersPageTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "users", label: "Users", icon: UsersIcon },
  { value: "roles", label: "Roles & permissions", icon: KeyRound },
  { value: "teams", label: "Teams", icon: UsersRound },
];

export default function UsersPage() {
  const [params, setParams] = useSearchParams();
  const canManageUsers = useHasPermission(PERM_USER_MANAGE);
  const canManageRoles = useHasPermission(PERM_ROLE_MANAGE);

  const visibleTabs = useMemo(
    () =>
      TABS.filter((t) => {
        // Reading roles is enough to see the matrix; the user editor needs it
        // for its dropdown, so user.manage opens the tab read-only.
        if (t.value === "roles") return canManageRoles || canManageUsers;
        if (t.value === "teams") return canManageUsers;
        return true;
      }),
    [canManageRoles, canManageUsers],
  );

  const requested = params.get("tab") as UsersPageTab | null;
  /**
   * An unknown or unauthorised tab falls back to Users rather than rendering
   * an empty frame. The fallback is not written back into the URL, so Back
   * still returns wherever the reader actually came from.
   */
  const active: UsersPageTab = visibleTabs.some((t) => t.value === requested)
    ? (requested as UsersPageTab)
    : "users";

  const selectTab = useCallback(
    (tab: UsersPageTab) => {
      const next = new URLSearchParams(params);
      // Users is the default, so it needs no parameter — keeps the canonical
      // URL clean and makes "?tab=users" and "" the same page.
      if (tab === "users") next.delete("tab");
      else next.set("tab", tab);
      setParams(next);
    },
    [params, setParams],
  );

  /** Arrow-key navigation, which a real tablist is expected to support. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = visibleTabs.findIndex((t) => t.value === active);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      selectTab(visibleTabs[(index + 1) % visibleTabs.length].value);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      selectTab(
        visibleTabs[(index - 1 + visibleTabs.length) % visibleTabs.length].value,
      );
    }
  };

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="User governance sections"
        onKeyDown={onKeyDown}
        className="inline-flex items-center rounded-lg border border-line bg-surface-2 p-1 text-muted"
      >
        {visibleTabs.map((tab) => {
          const selected = tab.value === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              role="tab"
              type="button"
              id={`tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.value}`}
              // Roving tabindex: Tab reaches the tablist once, then arrows
              // move within it — the expected keyboard model for tabs.
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(tab.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none",
                selected
                  ? "bg-surface text-ink shadow-xs border border-line/70"
                  : "hover:text-ink hover:bg-surface/50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
      >
        {active === "users" && <UsersTab />}
        {active === "roles" && <RolesTab />}
        {active === "teams" && <TeamsTab />}
      </div>
    </div>
  );
}
