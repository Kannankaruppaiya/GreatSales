# F12 — Users, Roles & Teams — Design Spec

**Date:** 2026-08-23
**Governing contract:** [`AGENTS.md`](../../../AGENTS.md)
**Roadmap slice:** [`docs/FEATURE-ROADMAP.md`](../../FEATURE-ROADMAP.md) → F12
**Status:** Approved for planning

---

## 1. Purpose

Give a tenant administrator complete, safe control over *who* can use GreatSales and *what*
they may do — without anyone touching the database. Today the Users page is a partially-wired
list with a hardcoded permissions card, a mock-data identity check, and no roles or teams
management at all.

This slice also discharges the debt F1 recorded: *"There is no self-service password recovery
today — an admin must reset a user directly. This is the first thing F12 should address."*

---

## 2. Verified defects this slice fixes

Every row below was read from the cited code and confirmed, not assumed.

### API

| # | Defect | Evidence | AGENTS.md |
| --- | --- | --- | --- |
| A1 | `?active=false` returns **active** users. `z.coerce.boolean()` maps the string `"false"` to `true`. Verified by running zod 3.25.76 directly. | `packages/shared/src/user.ts:14` | §1 |
| A2 | An admin can deactivate, soft-delete, or demote **themselves**. Removing the last admin locks the tenant out of its own administration permanently. | `apps/api/src/users/users.service.ts` — no guard on any path | §1, §8 |
| A3 | **Zero audit logging.** The `AuditLog` model exists and is unused by user create/update/delete. | `users.service.ts`; `schema.prisma:806` | §25 |
| A4 | An admin password reset does **not** revoke the target's refresh-token families. Deactivation does not either — the session survives until the next refresh attempt. | `auth.service.ts:228` re-checks `active` only on refresh | §7 |
| A5 | Soft-delete permanently burns the email and username: `@@unique([tenantId, email])` still matches the deleted row, so the address can never be reused. | `schema.prisma:246-247` | §8 |
| A6 | No `total` in the list response, no sort options, no `GET /users/:id`. | `users.service.ts:56-90` | §10 |
| A7 | An invalid `roleId` / `managerId` / `teamId` raises Prisma `P2025` and surfaces as **500**, not 400. No manager-cycle detection. | `users.service.ts:98-112` | §10, §8 |
| A8 | Email and username are normalised **client-side only**. The server accepts `Admin@x.test` and `admin@x.test` as distinct users. | `users.service.ts` vs `EditUserModal.tsx:41` | §1, §8 |
| A9 | No `GET /roles` endpoint exists anywhere in the API. | `apps/api/src` | §10 |
| A10 | **No HTTP e2e tests for users at all.** Nothing proves a `sales` user receives 403 from `/users`. | `apps/api/test/` contains only `app` and `auth` specs | §14 |

### Web

| # | Defect | Evidence | AGENTS.md |
| --- | --- | --- | --- |
| W1 | `useMockOwnerId()` compares a **mock-data id** against real user ids. `(you)` therefore never renders and the self-deactivation guard never engages. | `UsersPage.tsx:32,131`; `lib/mockOwner.ts` | §31 |
| W2 | Role filter and the create-user role dropdown are derived from **loaded rows**. A role with no users cannot be selected, so that role can never receive its first user. | `UsersPage.tsx:53-58` | §11 |
| W3 | The "Role permissions reference" card is **hardcoded static markup** with no relationship to actual `RolePermission` grants. It can silently lie. | `UsersPage.tsx:210-270` | §31 |
| W4 | The delete endpoint is never called from the UI. Deactivate fires immediately with **no confirmation**. | `UsersPage.tsx:160-171` | §11 |
| W5 | `"N users · M active"` counts **only loaded pages**, so it under-reports the moment pagination engages. | `UsersPage.tsx:47-48` | §11 |
| W6 | No manager, team, or last-login column; no status filter; no sorting. | `UsersPage.tsx` | §11 |
| W7 | `canEdit = role === "admin"` hides every action from `super_admin`. | `UsersPage.tsx:39` | §11 |

---

## 3. Decisions taken (2026-08-23)

| Question | Decision |
| --- | --- |
| Scope | **Full F12** — Users + Roles + Teams |
| Self-lockout policy | **Both guards**, server-side: no self-mutation, and the last permission-holder is protected |
| Admin password reset | **Revoke all sessions + force change on next login** (`mustChangePassword`) |
| Delete semantics | **Soft-delete, email freed for reuse, restore supported** |
| Roles | **Custom roles + permission editing.** System roles cannot be renamed or deleted |
| Teams | **Full CRUD + member assignment** |
| UI layout | **Tabs on `/users`**, synced to `?tab=` |
| Password policy | **min 12, max 128, common-password deny-list, no identity substrings** (NIST 800-63B) |

---

## 4. Schema

One migration: `20260823_f12_users_roles_teams`.

### 4.1 `User.mustChangePassword`

```prisma
mustChangePassword Boolean @default(false)
```

Set by `POST /users/:id/reset-password` and by `POST /users` (a user created with an
admin-chosen password must change it). Cleared when the user sets their own password.

`GET /auth/me` returns the flag so the web shell can force the change-password screen. **The
flag is advisory to the UI but authoritative on the server:** while it is true, the only
endpoints the user may call are `/auth/me`, `/auth/change-password`, and `/auth/logout`. A
guard enforces this — a client that ignores the flag gets 403, not data.

This makes `POST /auth/change-password` a **prerequisite of this slice, not an optional
extra**: an admin reset that forces a change is meaningless if the user has no way to perform
one. Verified absent — `auth.controller.ts` exposes only `login`, `refresh`, `logout`, and
`me`. See §5.4.

### 4.2 Partial unique indexes (A5)

`@@unique([tenantId, email])` and `@@unique([tenantId, username])` are dropped and replaced
with raw partial unique indexes, because Prisma cannot express a `WHERE` clause on `@@unique`:

```sql
CREATE UNIQUE INDEX "User_tenantId_email_live_key"
  ON "User" ("tenantId", "email") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "User_tenantId_username_live_key"
  ON "User" ("tenantId", "username") WHERE "deletedAt" IS NULL;
```

The Prisma model keeps `@@index([tenantId, email])` so the field pair stays queryable; the
uniqueness guarantee moves entirely to the partial indexes. A violation still raises `P2002`,
so the existing 409 mapping is unchanged.

**Confirmed safe:** `grep -rn "tenantId_email\|tenantId_username"` over `apps/` and `packages/`
returns nothing — no code performs a compound-unique lookup. `auth.service.ts:101` already uses
`findFirst({ where: { email, deletedAt: null, active: true } })`.

**Rollback risk.** Reverting to the plain unique constraint fails if two rows share an email
and one is soft-deleted. The down-migration must therefore refuse to run while such a pair
exists, and the recovery step (hard-delete or re-key the soft-deleted row) is documented in
`DEPLOYMENT.md`.

**Lock duration.** Both indexes are built `CONCURRENTLY` in production (documented in the
migration header); the migration file itself uses the plain form because Prisma runs
migrations inside a transaction. `DEPLOYMENT.md` carries the production procedure.

### 4.3 Indexes for the list

```prisma
@@index([tenantId, deletedAt, name])
```

Serves the default listing and the default `name asc` sort in one index.

**Search is deliberately left un-indexed for now.** `ILIKE '%term%'` cannot use a B-tree.
A per-tenant user table is a hundreds-to-low-thousands scale object, not millions, so a
trigram GIN index is not obviously justified. The implementation will record an
`EXPLAIN (ANALYZE, BUFFERS)` plan for the search query at 10k seeded users in
`docs/superpowers/plans/`, with the measured time. `pg_trgm` is added only if that number
exceeds 50 ms. This is AGENTS.md §6 ("measured, with the number written down") rather than
§5's "do not prematurely over-engineer" being ignored in either direction.

### 4.4 Roles are hard-deleted

`Role` gains no `deletedAt`. A soft-deleted role would leave `User.roleId` pointing at a row
that no longer appears in any list — a dangling reference that RBAC would then resolve to an
empty permission set, silently stripping access. Instead, `DELETE /roles/:id` refuses (409)
while any user — including soft-deleted users — still references the role.

### 4.5 RLS

`Role`, `Team`, and `User` are already covered by the dynamic tenant-isolation loop in
`20260815000000_rls_policies` (lines 44-58). `RolePermission` has an explicit policy joining
through `Role`. `Permission` is a global master table with no RLS by design. **No RLS changes
are required**, and a test asserts cross-tenant reads still return nothing.

---

## 5. API surface

All routes are already mounted under `/api/v1`. Every route below is authenticated; the
permission in brackets is enforced by `PermissionsGuard`.

### 5.1 Users — `user.manage`

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/users` | `cursor`, `limit`, `search`, `roleId`, `teamId`, `status`, `sort`, `includeDeleted`. Returns `{ items, nextCursor, total }` |
| `GET` | `/users/:id` | Single row, 404 if absent or soft-deleted (unless `?includeDeleted=true`) |
| `POST` | `/users` | Creates with `mustChangePassword = true` |
| `PATCH` | `/users/:id` | Partial. Password changes here also revoke sessions |
| `DELETE` | `/users/:id` | Soft-delete. 204. Revokes sessions |
| `POST` | `/users/:id/restore` | Un-deletes. 409 if the email or username has since been re-taken |
| `POST` | `/users/:id/reset-password` | Sets password, `mustChangePassword = true`, revokes every family |

`status` replaces the broken `active` param (A1): a `z.enum(["all","active","inactive"])` with
default `"all"`. There is no boolean coercion left to get wrong.

`sort` is `z.enum(["name","email","username","createdAt","lastLoginAt"])` with a `dir` of
`asc`/`desc`, default `name asc`. Cursor pagination stays keyset-based: the cursor encodes
`(sortValue, id)` so a stable total order survives ties.

### 5.2 Roles — `role.manage`

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/roles` | All tenant roles with `permissionKeys[]` and `userCount`. **Readable with `user.manage` too**, because the user editor needs the dropdown |
| `GET` | `/permissions` | The 13 keys from `PERMISSIONS`, grouped by module. Static, cacheable |
| `POST` | `/roles` | `{ name, permissionKeys[] }`. `isSystem` is always false |
| `PATCH` | `/roles/:id` | Rename and/or replace `permissionKeys`. System roles: permissions editable, name is not |
| `DELETE` | `/roles/:id` | 409 if `isSystem` or `userCount > 0` |

### 5.3 Teams — `user.manage`

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/teams` | Teams with `managerName` and `memberCount` |
| `POST` | `/teams` | `{ name, managerId }` |
| `PATCH` | `/teams/:id` | Rename, change manager |
| `DELETE` | `/teams/:id` | Soft-delete (`Team.deletedAt` exists). Members are detached in the same transaction |
| `POST` | `/teams/:id/members` | `{ userIds[] }` — bulk assign |
| `DELETE` | `/teams/:id/members/:userId` | Detach one |

### 5.4 Auth additions — authenticated, no permission required

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/change-password` | `{ currentPassword, newPassword }`. Verifies the current password, applies the §6 I5 policy, re-hashes with argon2id, clears `mustChangePassword`, and revokes **every other** family while keeping the caller signed in |

This closes the F1 D10 deferral for the *change* half. Forgot-password by email stays out of
scope pending the mail-provider decision (§12).

`GET /auth/me` gains two fields the web layer needs and cannot safely infer: `permissions`
(the caller's resolved permission keys, for §8.3) and `mustChangePassword`. Both are additive,
so existing consumers are unaffected (AGENTS.md §23).

### 5.5 Reusable revocation helper

`auth.service.ts` already revokes a single family (`revokeFamily`, line 191) and already
revokes every family for a user inline in `logout(all)` (line 288). The latter is extracted
into `revokeAllForUser(db, userId, reason)` and exported through `AuthModule`, so the users
service can call it inside its own transaction. `logout` is refactored to call the same helper
— one implementation, not two.

---

## 6. Server-enforced invariants

Each invariant gets a **deny-path integration test and a deny-path HTTP e2e test**. An allow
path alone does not count as coverage (AGENTS.md, Definition of Done §3).

| # | Invariant | Status |
| --- | --- | --- |
| I1 | A caller may not deactivate, soft-delete, or change the role of **their own** account | 409 `SELF_MUTATION_FORBIDDEN` |
| I2 | The **last** active, non-deleted holder of `user.manage` may not be deactivated, deleted, or moved to a role lacking it | 409 `LAST_ADMIN_PROTECTED` |
| I3 | `managerId` must be a live user in the same tenant, must not be the user itself, and must not create a cycle (the chain is walked to the root, bounded at 64 hops) | 400 `INVALID_MANAGER` |
| I4 | `email` and `username` are trimmed and lower-cased **server-side** before validation and storage | — |
| I5 | Passwords: ≥12 chars, ≤128 bytes, not in the bundled common-password list, and containing no case-insensitive substring of the user's name, email local-part, or username of length ≥4 | 400 `WEAK_PASSWORD` |
| I6 | A system role may not be renamed or deleted | 409 `SYSTEM_ROLE_PROTECTED` |
| I7 | A role that still has users may not be deleted | 409 `ROLE_IN_USE` |
| I8 | The last role holding `user.manage` and `role.manage` may not have either permission removed | 409 `LAST_ADMIN_ROLE_PROTECTED` |
| I9 | An unknown `roleId`, `managerId`, or `teamId` yields **400**, never a 500 | 400 `INVALID_REFERENCE` |
| I10 | A team's manager must be a live user in the same tenant | 400 `INVALID_MANAGER` |

I2 and I8 are the two that make administration recoverable; both are checked **inside the same
transaction as the write**, using a `SELECT … FOR UPDATE`-equivalent guard, so two concurrent
requests cannot each observe "one other admin remains" and both proceed. A concurrency test
fires the two requests in parallel and asserts exactly one succeeds.

### 6.1 Error contract

Every failure returns the existing envelope from `AllExceptionsFilter`, extended with a stable
machine-readable `code` (the `SCREAMING_SNAKE` strings above). The web layer switches on
`code`, never on the human message, so wording can change without breaking the UI.

---

## 7. Side effects on every mutation

### 7.1 Audit

Each of create / update / delete / restore / reset-password / role change / team change writes
one `AuditLog` row inside the **same transaction as the write**, so an audit gap is impossible:

```
{ tenantId, userId: <actor>, action: "user.update", entity: "User",
  entityId, before: {...}, after: {...}, at }
```

`passwordHash` is stripped from both `before` and `after`; the plaintext password never enters
a log line, an audit row, or an error message. A test asserts that no audit row for any user
mutation contains a key matching `/password/i`.

### 7.2 Session revocation

Deactivation, soft-delete, password change, password reset, and role change all call
`revokeAllForUser(db, userId, reason)` (§5.5) in the same transaction. Today the containment
window is the access token's TTL; this closes the refresh path immediately rather than at the
next refresh attempt. The reason string is distinct per cause
(`admin_deactivated`, `admin_deleted`, `admin_password_reset`, `role_changed`,
`self_password_change`) so an operator can tell from the row why a session ended.

Role change revokes because the access token carries `roleId`, so a demoted user would
otherwise keep the old role's permissions until the token expired.

---

## 8. Web

### 8.1 Structure

`/managements/:managementId/users` renders `UsersPage`, which becomes a thin shell over three
tabs, synced to a `?tab=users|roles|teams` search param so refresh, back, and deep links work.

```
features/users/
  UsersPage.tsx          shell + tab routing            (~90 lines)
  tabs/UsersTab.tsx      list, filters, row actions
  tabs/RolesTab.tsx      role list + permission matrix
  tabs/TeamsTab.tsx      team list + members
  modals/UserFormModal.tsx      create / edit
  modals/ResetPasswordModal.tsx
  modals/ConfirmActionModal.tsx  shared confirm
  modals/RoleFormModal.tsx
  modals/TeamFormModal.tsx
  PasswordField.tsx      strength meter + generate + reveal
  queries.ts             users hooks
  roles.queries.ts       roles + permissions hooks
  teams.queries.ts       teams hooks
  types.ts               wire types
```

The current `UsersPage.tsx` is 280 lines carrying list, filters, modals, and a hardcoded
permissions table. Splitting it is not gratuitous refactoring — every one of those
responsibilities is being changed by this slice.

### 8.2 Users tab

Columns: Name · Username · Email · Role · Team · Manager · Last login · Status · Actions.
Filters: search (debounced 300 ms, server-side), role, team, status, and a "Show deleted"
toggle. Sorting by clicking a column header, reflected in the query.

Row actions, each behind a confirmation naming the user and stating the consequence:

- **Edit** — opens the form modal
- **Deactivate / Activate** — "Ends all their sessions immediately"
- **Reset password** — opens the reset modal
- **Delete** — "Frees their email and username for reuse; can be restored"
- **Restore** — only on deleted rows

The count in the header reads the server's `total`, not the loaded page length (W5).

### 8.3 Identity and permissions (W1, W7)

`useMockOwnerId()` is removed from this page entirely. The current user's id comes from
`useAuth((s) => s.user?.id)`. `(you)` renders correctly and every self-guard engages.

Action visibility is driven by the caller's **permission set**, not a role string. The auth
store exposes `usePermissions()`, derived from `/auth/me`. `canManageUsers` is
`has("user.manage")`; `canManageRoles` is `has("role.manage")`. This fixes `super_admin`
seeing no actions, and makes a custom role with `user.manage` work correctly.

**This is presentation only.** Every guard is enforced server-side and proved by a deny test;
the UI merely avoids offering buttons that would 403 (AGENTS.md §7: never rely on frontend
restrictions for security).

### 8.4 Roles tab (W3)

The hardcoded reference table is deleted. In its place, a live matrix: roles down the side,
the 13 permission keys grouped by module across the top, checkboxes reflecting real
`RolePermission` rows. Editable when the caller holds `role.manage`; read-only otherwise.
System roles show a lock on the name field. The last-admin-role guard (I8) disables the
relevant checkbox with an explanatory tooltip *and* is enforced server-side.

### 8.5 Teams tab

Team list with name, manager, member count. Create / rename / change manager / delete.
Expanding a row lists members with a remove control and an "Add members" picker.

### 8.6 States

Every tab renders all five states through `QueryBoundary`: loading (skeleton rows), error
(message + retry), empty (with the action that resolves it), populated, and
**permission-denied** (an explicit "You do not have permission to manage users" panel rather
than an empty table, which would read as "there are no users").

### 8.7 Accessibility

Tables get a `<caption>`; sortable headers use `aria-sort`; icon-only controls carry
`aria-label`; modals trap focus and restore it on close; validation errors are tied to their
input with `aria-describedby` and announced via `role="alert"`; the tab strip is a real
`role="tablist"` with arrow-key navigation.

---

## 9. Testing

| Layer | File | Covers |
| --- | --- | --- |
| API integration | `users.service.spec.ts` (expanded) | CRUD, RLS isolation, I1–I5, I9, audit rows, session revocation, restore, pagination + total, sort, search |
| API integration | `roles.service.spec.ts` | CRUD, I6–I8, permission replacement, userCount |
| API integration | `teams.service.spec.ts` | CRUD, I10, member assign/detach, delete detaches members |
| API integration | `users.concurrency.spec.ts` | Two parallel last-admin deletions — exactly one succeeds |
| API e2e HTTP | `users.e2e-spec.ts` | Every route: 401 unauthenticated, **403 as `sales`**, 400 validation, 404, 409 invariants, 204 delete, cross-tenant 404 |
| API e2e HTTP | `roles.e2e-spec.ts` | Same shape, plus `role.manage` vs `user.manage` separation |
| API e2e HTTP | `teams.e2e-spec.ts` | Same shape |
| API integration | `auth.change-password.spec.ts` | Wrong current password rejected, weak new password rejected, other families revoked but caller stays valid, `mustChangePassword` cleared |
| API e2e HTTP | `auth.e2e-spec.ts` (extended) | `mustChangePassword` gate — a flagged user gets 403 from `/users` but 200 from `/auth/me` and `/auth/change-password` |
| Web component | `UsersPage.tabs.test.tsx` | Tab switching, `?tab=` sync, deep link, back button |
| Web component | `UsersTab.filters.test.tsx` | Search debounce, role/team/status filters, sort, show-deleted, total |
| Web component | `UsersTab.actions.test.tsx` | Confirm flows, self-guard, optimistic states, error surfacing |
| Web component | `UsersTab.permissions.test.tsx` | Permission-denied panel, hidden actions per permission set |
| Web component | `RolesTab.test.tsx` | Matrix renders real grants, edit, system-role lock, I8 disabled checkbox |
| Web component | `TeamsTab.test.tsx` | CRUD, member add/remove |
| Web component | `UserFormModal.test.tsx` | Validation, password strength, manager/team dropdowns, 409 handling |
| Web unit | `passwordPolicy.test.ts` | Shared policy — same cases run against the API's copy |
| Web unit | `roles.queries.test.ts`, `teams.queries.test.ts` | Query keys, invalidation, cursor handling |

API tests are **integration tests against real Postgres through the RLS-bound `greatsales_app`
role**. Prisma is never mocked (AGENTS.md, Definition of Done §5).

The password policy lives in `packages/shared` and is imported by both sides, so the client
cannot drift from the server. The same table-driven case list is executed in both suites.

---

## 10. Observability

Every mutation emits a structured log line via the existing auth-event helper pattern:
`{ event: "user.deactivated", requestId, tenantId, actorId, targetId, outcome }`. Denied
invariants log at `warn` with the invariant code, so an operator can see that someone
repeatedly tried to delete the last admin. No password, hash, or token ever appears.

---

## 11. Performance

| Query | Expectation | How verified |
| --- | --- | --- |
| `GET /users` default page (50) | < 20 ms | `EXPLAIN (ANALYZE, BUFFERS)` at 10k users, number recorded in the plan |
| `GET /users?search=` | < 50 ms, else add `pg_trgm` | same |
| `GET /roles` | < 10 ms | roles per tenant are single digits; `permissionKeys` fetched in one include, **not** N+1 |
| `total` count | Counted in the same transaction as the page, not a second round trip | — |

The list must not N+1 on role, manager, or team — the existing `USER_INCLUDE` already handles
that and is retained.

---

## 12. Out of scope

- Self-service password recovery by email (still blocked on the mail-provider decision, AGENTS.md §20)
- MFA, SSO, device management, "sessions on other devices" UI (F1 non-goals, unchanged)
- Cross-tenant user administration / the super-admin tenant switcher (that is F14)
- Bulk user import from CSV (that is F15)

---

## 13. Definition of Done for this slice

All ten roadmap criteria, plus specifically:

- Every invariant in §6 has a passing deny test at both the service and HTTP layer
- `useMockOwnerId` no longer appears in `features/users/`
- The hardcoded permissions table no longer exists
- `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter web test`,
  `pnpm check-types`, `pnpm lint` all green, with real output pasted
- `EXPLAIN` numbers from §11 recorded
- `CHANGELOG.md`, `SECURITY.md` (session revocation), `DEPLOYMENT.md` (concurrent index
  procedure and the down-migration guard) updated
