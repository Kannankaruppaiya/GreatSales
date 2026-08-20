# SDD ledger — plan: docs/superpowers/plans/2026-08-19-phase0-tenant-login-unify.md

Mode: INLINE execution on branch `feat/phase0-auth-unify`. COMMITS HELD (per user CLAUDE.md rule) — no per-task git commits; track by task state + build/test green. Uncommitted backend work from `main` carried onto this branch.

Task 1: complete (files: apps/web/src/lib/authRole.ts + authRole.test.ts; test 3/3 green; NOT committed)
Task 2: complete (apps/web/src/store/auth.ts rewritten: useAuth single-source + SalesWebLoginError + selector hooks useIsAuthed/useAuthUser/useAuthRole/useIsOwner; auth.test.ts 3/3 green; NOT committed)
Task 3: complete (apps/web/src/lib/config.ts: added env.DEMO_TENANT_ID/DEMO_EMAIL/DEMO_PASSWORD)

Task 4: complete (App.tsx guards + RoleGuard/RequireOwner/ManagementProvider/layout read useAuth)
Task 5: complete (LoginPage real async login, tenant id field, demo prefill, super_admin note, error banner)
Task 6: complete (ProjectionsPage: ConnectPanel/DEFAULTS/gate/Disconnect removed, consumes accessToken)
Task 7: complete (ui.ts stripped to UI-prefs, persist v7)
Task 7b (SCOPE EXPANSION — Option B full strip, done by subagent): migrated ALL mock pages (Dashboard/FollowUps/Customers/Leads/Orders/Payments/Products/Users/ManagementHome/Data/ProjectionsPage.mock) + modals + hooks.ts + ManagementSwitcher + 6 test files to useAuth via useAuthRole()/useMockOwnerId()/useIsOwner()/useAuth.logout. DataPage role-sim RETIRED (read-only role display). New helper: lib/mockOwner.ts.
Task 8: complete (main.tsx QueryCache/MutationCache onError → 401 logout)
BUILD: clean. TESTS: 27/30 (12/13 files). 1 PRE-EXISTING failure (NOT our regression, NOT auth): tests/pages/ManagementHomePage.test.tsx (3) asserts OLD page copy ("create management"/"search managements") but page was redesigned (uncommitted) to "Company Workspaces"/"Create Workspace". Needs test-update to match redesigned page OR defer — OUT OF PHASE 0 SCOPE.

RESUME AT: Task 9 (browser E2E verify — needs API+seeded DB running + web dev server). Original Task 4 (point guards/chrome at useAuth). Selector hooks to import from "../store/auth" (or "./store/auth" in App.tsx): useIsAuthed, useAuthRole, useIsOwner, useAuthUser, plus useAuth((s)=>s.logout). Files: App.tsx (4 guards), components/{RoleGuard,RequireOwner,ManagementProvider,layout}.tsx. Then Task 5 LoginPage real login, Task 6 ProjectionsPage cleanup, Task 7 strip useUi auth fields + persist v6->7, Task 8 401->logout in main.tsx, Task 9 browser verify. Verify cmds: `pnpm --filter web build`, `pnpm --filter web test`. Commits HELD.
