# F12 — Users, Roles & Teams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a tenant administrator complete, safe control over users, roles, and teams from the web UI — with every destructive path guarded server-side, audited, and proved by a deny test.

**Architecture:** Three new NestJS resource modules (`roles`, `teams`) plus a substantially extended `users` module, all reading and writing through the RLS-bound `greatsales_app` Postgres role via `prisma.forTenant()`. Invariants that protect administrative access (self-mutation, last-admin) are checked inside the same interactive transaction as the write, so concurrent requests cannot both pass. The web `/users` route becomes a three-tab shell whose action visibility derives from the caller's real permission set, never a role string.

**Tech Stack:** NestJS 10 · Prisma 6 · PostgreSQL (RLS) · Zod 3 · Jest + Supertest · React 19 · TanStack Query 5 · Zustand 5 · Vitest + Testing Library · Tailwind

**Spec:** [`docs/superpowers/specs/2026-08-23-f12-users-roles-teams-design.md`](../specs/2026-08-23-f12-users-roles-teams-design.md)

---

## Global Constraints

Every task's requirements implicitly include this section.

- **AGENTS.md governs.** Production-first. No mocks, no TODOs, no silent catches in any production path.
- **API tests are integration tests against real Postgres** through the RLS-bound `greatsales_app` role. **Prisma is never mocked.** Every spec begins with `import '../load-env'` and reseeds via `execSync('pnpm --filter @greatsales/db db:seed')` in `beforeAll` with a 120 s timeout.
- **Every invariant needs a deny test at both layers** — service integration *and* HTTP e2e. An allow-path test alone does not satisfy the Definition of Done.
- **Never rely on frontend restrictions for security.** UI permission checks hide buttons; the server rejects the request regardless.
- **Passwords:** the plaintext never enters a log line, an audit row, an error message, or a response body. `passwordHash` is stripped from every projection and every audit payload.
- **Password policy (single source):** min 12 chars, max 128 bytes, not in the bundled common-password list, no case-insensitive substring ≥4 chars shared with the user's name, email local-part, or username. Lives in `packages/shared`, imported by API and web.
- **Error codes** are `SCREAMING_SNAKE` strings on the `ApiErrorBody.code` field. The web switches on `code`, never on the human message.
- **Tenant scoping:** every query goes through `this.prisma.forTenant(user.tenantId)`. Multi-statement writes use `forTenant(...).$transaction(async (tx) => ...)` so the `set_config` applies to the whole transaction.
- **Commit after every task** with a conventional-commit message.
- **Do not touch other features.** Files outside `auth`, `users`, `roles`, `teams`, `packages/shared`, `packages/db`, and `apps/web/src/features/users` are modified only where this plan names them explicitly.

---

## File Structure

### `packages/shared/src/`

| File | Responsibility |
| --- | --- |
| `errors.ts` | **Create.** `ErrorCode` union + the `code` field on `ApiErrorBody` |
| `password.ts` | **Create.** `PasswordPolicySchema`, `validatePassword()`, `COMMON_PASSWORDS` |
| `user.ts` | **Modify.** Fix `active`→`status` enum, add `sort`/`dir`/`teamId`/`includeDeleted`, add `total`, add `mustChangePassword` to `UserRow`, reset-password schema |
| `role.ts` | **Create.** `RoleRow`, `RoleCreateSchema`, `RoleUpdateSchema`, `PermissionGroup` |
| `team.ts` | **Create.** `TeamRow`, `TeamCreateSchema`, `TeamUpdateSchema`, `TeamMembersSchema` |
| `auth.ts` | **Modify.** `AuthUser` gains `permissions: string[]` and `mustChangePassword: boolean`; add `ChangePasswordSchema` |
| `http.ts` | **Modify.** `ApiErrorBody.code?: ErrorCode` |
| `index.ts` | **Modify.** Re-export the new modules |

### `packages/db/prisma/`

| File | Responsibility |
| --- | --- |
| `schema.prisma` | **Modify.** `User.mustChangePassword`, drop two `@@unique`, add composite index |
| `migrations/20260823120000_f12_users_roles_teams/migration.sql` | **Create.** Column + partial unique indexes + composite index |
| `seed.ts` | **Modify.** Second admin per tenant, a role with no users, a second team, 12 sales users for pagination |

### `apps/api/src/`

| File | Responsibility |
| --- | --- |
| `common/error-codes.ts` | **Create.** `codedConflict()`, `codedBadRequest()`, `codedNotFound()` helpers |
| `common/all-exceptions.filter.ts` | **Modify.** Pass `code` through the envelope |
| `common/must-change-password.guard.ts` | **Create.** Blocks a flagged user from everything but the escape hatch |
| `auth/auth.service.ts` | **Modify.** Extract `revokeAllForUser`, add `changePassword`, extend `me` |
| `auth/auth.controller.ts` | **Modify.** `POST /auth/change-password` |
| `auth/auth.module.ts` | **Modify.** Export `AuthService` |
| `users/users.service.ts` | **Modify.** Split — becomes orchestration only |
| `users/user-invariants.ts` | **Create.** I1–I3, I9 pure guards + last-admin check |
| `users/users.audit.ts` | **Create.** Audit row construction + redaction |
| `users/users.controller.ts` | **Modify.** New routes |
| `roles/roles.{service,controller,module}.ts` | **Create.** |
| `teams/teams.{service,controller,module}.ts` | **Create.** |

### `apps/web/src/features/users/`

| File | Responsibility |
| --- | --- |
| `UsersPage.tsx` | **Rewrite.** Tab shell + `?tab=` sync only (~90 lines) |
| `tabs/UsersTab.tsx` | **Create.** List, filters, sort, row actions |
| `tabs/RolesTab.tsx` | **Create.** Role list + live permission matrix |
| `tabs/TeamsTab.tsx` | **Create.** Team list + members |
| `modals/UserFormModal.tsx` | **Create.** Replaces `EditUserModal.tsx` (deleted) |
| `modals/ResetPasswordModal.tsx` | **Create.** |
| `modals/ConfirmActionModal.tsx` | **Create.** Shared destructive confirm |
| `modals/RoleFormModal.tsx` | **Create.** |
| `modals/TeamFormModal.tsx` | **Create.** |
| `PasswordField.tsx` | **Create.** Strength meter, generate, reveal |
| `queries.ts` | **Modify.** New params, total, new mutations |
| `roles.queries.ts` | **Create.** |
| `teams.queries.ts` | **Create.** |
| `types.ts` | **Modify.** Mirror the shared contracts |

---

## Phase 0 — Shared contracts and schema

### Task 1: Error codes and password policy in `packages/shared`

**Files:**
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/src/password.ts`
- Modify: `packages/shared/src/http.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/password.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type ErrorCode` — the union of all codes below
  - `validatePassword(plain: string, identity: { name?: string; email?: string; username?: string }): { ok: true } | { ok: false; reason: PasswordFailure }`
  - `type PasswordFailure = "TOO_SHORT" | "TOO_LONG" | "TOO_COMMON" | "CONTAINS_IDENTITY"`
  - `PASSWORD_MIN = 12`, `PASSWORD_MAX = 128`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validatePassword, PASSWORD_MIN, PASSWORD_MAX } from "./password";

const NOBODY = { name: "Zaphod Beeblebrox", email: "zb@acme.test", username: "zaphod" };

describe("validatePassword", () => {
  it("accepts a long, unrelated, uncommon password", () => {
    expect(validatePassword("correct-horse-battery-staple", NOBODY)).toEqual({ ok: true });
  });

  it("rejects anything shorter than the minimum", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN - 1), NOBODY)).toEqual({
      ok: false,
      reason: "TOO_SHORT",
    });
  });

  it("rejects anything longer than the maximum, to bound argon2 CPU cost", () => {
    expect(validatePassword("a".repeat(PASSWORD_MAX + 1), NOBODY)).toEqual({
      ok: false,
      reason: "TOO_LONG",
    });
  });

  it("measures length in UTF-8 bytes, not code points", () => {
    // 'é' is two bytes; 65 of them exceed a 128-byte budget.
    expect(validatePassword("é".repeat(65), NOBODY)).toEqual({ ok: false, reason: "TOO_LONG" });
  });

  it("rejects a common password even when it is long enough", () => {
    expect(validatePassword("password123456", NOBODY)).toEqual({ ok: false, reason: "TOO_COMMON" });
  });

  it("is case-insensitive about common passwords", () => {
    expect(validatePassword("PassWord123456", NOBODY)).toEqual({ ok: false, reason: "TOO_COMMON" });
  });

  it("rejects a password containing the username", () => {
    expect(validatePassword("xxzaphodxxxxxxxx", NOBODY)).toEqual({
      ok: false,
      reason: "CONTAINS_IDENTITY",
    });
  });

  it("rejects a password containing the email local-part", () => {
    expect(validatePassword("qqqqzbqqqqqqqqqq", { email: "zb@acme.test" })).toEqual({ ok: true });
    // 'zb' is only 2 chars — below the 4-char significance floor, so it passes.
    expect(validatePassword("qqqqbeeblebroxqq", { email: "beeblebrox@acme.test" })).toEqual({
      ok: false,
      reason: "CONTAINS_IDENTITY",
    });
  });

  it("rejects a password containing a name word", () => {
    expect(validatePassword("xxZaphodxxxxxxxx", { name: "Zaphod Beeblebrox" })).toEqual({
      ok: false,
      reason: "CONTAINS_IDENTITY",
    });
  });

  it("ignores identity fragments shorter than four characters", () => {
    expect(validatePassword("anders-and-more-x", { name: "An Do", username: "an" })).toEqual({
      ok: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @greatsales/shared test password`
Expected: FAIL — `Cannot find module './password'`

*(If `@greatsales/shared` has no `test` script yet, add `"test": "vitest run"` and `vitest` to its devDependencies as part of this step, then rerun.)*

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/password.ts`:

```ts
/**
 * The single password policy for GreatSales, imported by BOTH the API and the
 * web client so the two can never drift. The server is authoritative; the
 * client uses it only to give immediate feedback.
 *
 * Modelled on NIST SP 800-63B: length and blocklist, deliberately NOT
 * composition rules (which push users toward predictable substitutions).
 */

export const PASSWORD_MIN = 12;
/** Bytes, not characters — argon2 hashes the byte string, so this bounds CPU cost. */
export const PASSWORD_MAX = 128;

/** Identity fragments shorter than this are too generic to be worth blocking. */
const IDENTITY_MIN_FRAGMENT = 4;

/**
 * Passwords seen most often in credential-stuffing corpora, normalised to
 * lowercase. Deliberately small and inlined: a full 100k-entry list belongs
 * behind a service call, not in a bundle shipped to the browser. Anything
 * here is rejected outright regardless of length.
 */
export const COMMON_PASSWORDS: readonly string[] = [
  "password", "password1", "password12", "password123", "password1234",
  "password12345", "password123456", "passw0rd", "p@ssw0rd", "p@ssword123",
  "123456", "1234567", "12345678", "123456789", "1234567890", "12345678910",
  "qwerty", "qwerty123", "qwertyuiop", "qwerty123456", "1qaz2wsx3edc",
  "letmein", "letmein123", "welcome", "welcome1", "welcome123", "welcome12345",
  "admin", "admin123", "administrator", "adminadmin", "admin@123456",
  "iloveyou", "monkey", "dragon", "sunshine", "princess", "football",
  "abc123", "abcd1234", "abcdefghijkl", "aaaaaaaaaaaa", "000000000000",
  "changeme", "changeme123", "trustno1", "starwars", "superman",
  "greatsales", "greatsales123", "salesforce123",
];

const COMMON_SET = new Set(COMMON_PASSWORDS);

export type PasswordFailure =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "TOO_COMMON"
  | "CONTAINS_IDENTITY";

export type PasswordResult = { ok: true } | { ok: false; reason: PasswordFailure };

export interface PasswordIdentity {
  name?: string;
  email?: string;
  username?: string;
}

/** Human-readable reason, safe to show a user. Never echoes the password. */
export const PASSWORD_FAILURE_MESSAGE: Record<PasswordFailure, string> = {
  TOO_SHORT: `Password must be at least ${PASSWORD_MIN} characters.`,
  TOO_LONG: `Password must be at most ${PASSWORD_MAX} bytes.`,
  TOO_COMMON: "That password is too common. Choose something less predictable.",
  CONTAINS_IDENTITY: "Password must not contain your name, email, or username.",
};

/**
 * Splits an identity into the fragments worth blocking: name words, the email
 * local-part and its word pieces, and the username.
 */
function identityFragments(identity: PasswordIdentity): string[] {
  const raw: string[] = [];
  if (identity.name) raw.push(...identity.name.split(/[^\p{L}\p{N}]+/u));
  if (identity.username) raw.push(identity.username);
  if (identity.email) {
    const local = identity.email.split("@")[0] ?? "";
    raw.push(local, ...local.split(/[^\p{L}\p{N}]+/u));
  }
  return raw
    .map((f) => f.trim().toLowerCase())
    .filter((f) => f.length >= IDENTITY_MIN_FRAGMENT);
}

/**
 * Validates a plaintext password. Returns a discriminated result rather than
 * throwing, so the API can map it to a 400 with a code and the web can render
 * it inline — from the same call.
 */
export function validatePassword(
  plain: string,
  identity: PasswordIdentity = {},
): PasswordResult {
  if (plain.length < PASSWORD_MIN) return { ok: false, reason: "TOO_SHORT" };

  // Byte length, because argon2's cost scales with bytes and multi-byte
  // characters would otherwise let a "64-character" password cost double.
  const byteLength = new TextEncoder().encode(plain).length;
  if (byteLength > PASSWORD_MAX) return { ok: false, reason: "TOO_LONG" };

  const lower = plain.toLowerCase();
  if (COMMON_SET.has(lower)) return { ok: false, reason: "TOO_COMMON" };

  for (const fragment of identityFragments(identity)) {
    if (lower.includes(fragment)) return { ok: false, reason: "CONTAINS_IDENTITY" };
  }

  return { ok: true };
}

/**
 * Coarse 0-4 strength score for the UI meter ONLY. Never used as a gate —
 * `validatePassword` is the gate. Scores length and character-class variety.
 */
export function passwordStrength(plain: string): 0 | 1 | 2 | 3 | 4 {
  if (!plain) return 0;
  let score = 0;
  if (plain.length >= PASSWORD_MIN) score++;
  if (plain.length >= 16) score++;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(plain)).length;
  if (classes >= 2) score++;
  if (classes >= 3) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}
```

Create `packages/shared/src/errors.ts`:

```ts
/**
 * Machine-readable error codes. The web layer branches on these, never on the
 * human message, so wording can change without breaking a client.
 *
 * One code per distinct business rule — not one per HTTP status.
 */
export const ERROR_CODES = [
  // Users
  "SELF_MUTATION_FORBIDDEN",
  "LAST_ADMIN_PROTECTED",
  "INVALID_MANAGER",
  "WEAK_PASSWORD",
  "INVALID_REFERENCE",
  "DUPLICATE_IDENTITY",
  "USER_NOT_FOUND",
  "RESTORE_CONFLICT",
  // Roles
  "SYSTEM_ROLE_PROTECTED",
  "ROLE_IN_USE",
  "LAST_ADMIN_ROLE_PROTECTED",
  "ROLE_NOT_FOUND",
  // Teams
  "TEAM_NOT_FOUND",
  // Auth
  "WRONG_CURRENT_PASSWORD",
  "PASSWORD_CHANGE_REQUIRED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
```

Modify `packages/shared/src/http.ts` — add the field:

```ts
import type { ErrorCode } from "./errors";

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  /**
   * Stable machine-readable cause. Present on every error the API raises
   * deliberately; absent on unexpected 500s, which have no business meaning.
   */
  code?: ErrorCode;
  message: string;
  details?: unknown;
  path?: string;
  timestamp?: string;
}
```

Modify `packages/shared/src/index.ts` — add `export * from "./errors";` and `export * from "./password";`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @greatsales/shared test password`
Expected: PASS — 10 tests

- [ ] **Step 5: Verify the whole workspace still type-checks**

Run: `pnpm check-types`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/errors.ts packages/shared/src/password.ts packages/shared/src/password.test.ts packages/shared/src/http.ts packages/shared/src/index.ts packages/shared/package.json
git commit -m "feat(shared): add error codes and the single password policy"
```

---

### Task 2: Database migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma:201-250`
- Create: `packages/db/prisma/migrations/20260823120000_f12_users_roles_teams/migration.sql`
- Test: `packages/db/prisma/migration.f12.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `User.mustChangePassword: boolean`; partial unique indexes `User_tenantId_email_live_key` and `User_tenantId_username_live_key`; composite index `User_tenantId_deletedAt_name_idx`

- [ ] **Step 1: Write the failing test**

Create `packages/db/prisma/migration.f12.spec.ts`. This is a real database test — it proves the *behaviour* the migration buys, not merely that DDL ran.

```ts
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Proves the F12 migration's two behavioural guarantees:
 *   1. A soft-deleted user frees its email and username for reuse.
 *   2. Two LIVE users still cannot share an email or username.
 *
 * Runs as the migration/superuser role (the seed's DATABASE_URL), because it
 * is testing DDL, not RLS.
 */
const prisma = new PrismaClient();

const TENANT = "tenant_acme";
let created: string[] = [];

beforeAll(() => {
  execSync("pnpm --filter @greatsales/db db:seed", { stdio: "ignore" });
}, 120_000);

afterEach(async () => {
  if (created.length) {
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    created = [];
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function makeUser(suffix: string, deleted = false) {
  const u = await prisma.user.create({
    data: {
      tenantId: TENANT,
      name: `Fixture ${suffix}`,
      email: "reuse@acme.test",
      username: "reuse_acme",
      passwordHash: "x",
      roleId: "role_sales_acme",
      ...(deleted ? { deletedAt: new Date() } : {}),
    },
  });
  created.push(u.id);
  return u;
}

describe("F12 migration", () => {
  it("adds mustChangePassword defaulting to false", async () => {
    const u = await prisma.user.findFirstOrThrow({ where: { id: "user_admin_acme" } });
    expect(u.mustChangePassword).toBe(false);
  });

  it("frees a soft-deleted user's email and username for reuse", async () => {
    await makeUser("first", true); // soft-deleted
    await expect(makeUser("second", false)).resolves.toBeDefined();
  });

  it("still rejects two live users sharing an email", async () => {
    await makeUser("live-one", false);
    await expect(makeUser("live-two", false)).rejects.toMatchObject({ code: "P2002" });
  });

  it("still rejects reviving a soft-deleted user onto a taken identity", async () => {
    const ghost = await makeUser("ghost", true);
    await makeUser("live", false);
    await expect(
      prisma.user.update({ where: { id: ghost.id }, data: { deletedAt: null } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @greatsales/db test migration.f12`
Expected: FAIL — `mustChangePassword` does not exist, and the reuse test fails with P2002.

*(Add `"test": "jest"` plus `jest`/`ts-jest` to `packages/db` if it has no test runner. Reuse the config shape from `apps/api/package.json`.)*

- [ ] **Step 3: Edit the Prisma schema**

In `packages/db/prisma/schema.prisma`, inside `model User`:

Add after `lockedUntil`:

```prisma
  /// Set when an admin creates or resets this user's password. While true the
  /// user may call only /auth/me, /auth/change-password and /auth/logout.
  mustChangePassword Boolean @default(false)
```

Replace the two unique attributes and the index block at the end of the model:

```prisma
  // Uniqueness is enforced by PARTIAL unique indexes (see the F12 migration):
  // only rows with deletedAt IS NULL participate, so a soft-deleted user frees
  // its email and username for reuse. Prisma cannot express a WHERE clause on
  // @@unique, so these are plain indexes here and real constraints in SQL.
  @@index([tenantId, email])
  @@index([tenantId, username])
  @@index([tenantId, deletedAt, name])
  @@index([tenantId])
  @@index([managerId])
  @@index([teamId])
  @@index([deletedAt])
```

- [ ] **Step 4: Write the migration SQL**

Create `packages/db/prisma/migrations/20260823120000_f12_users_roles_teams/migration.sql`:

```sql
-- F12 — Users, Roles & Teams
--
-- PRODUCTION NOTE ------------------------------------------------------------
-- Prisma runs migrations inside a transaction, so the index builds below take
-- a brief ACCESS EXCLUSIVE lock on "User". On a small User table (thousands of
-- rows per tenant) that is single-digit milliseconds and safe to run inline.
--
-- If "User" has grown past ~1M rows, do NOT run this file directly. Instead run
-- the CONCURRENTLY variants outside a transaction first, then mark this
-- migration applied with `prisma migrate resolve --applied`. The exact
-- procedure is in DEPLOYMENT.md → "F12 index migration".
--
-- ROLLBACK -------------------------------------------------------------------
-- Reverting to the plain UNIQUE constraints FAILS if a soft-deleted row shares
-- an email or username with a live row. The guard below is the down-migration's
-- precondition; recovery is documented in DEPLOYMENT.md.
-- ---------------------------------------------------------------------------

-- 1. Forced password change after an admin-set credential -------------------
ALTER TABLE "User"
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- 2. Uniqueness becomes partial, so soft-delete frees the identity ----------
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tenantId_email_key";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tenantId_username_key";
DROP INDEX IF EXISTS "User_tenantId_email_key";
DROP INDEX IF EXISTS "User_tenantId_username_key";

CREATE UNIQUE INDEX "User_tenantId_email_live_key"
  ON "User" ("tenantId", "email")
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "User_tenantId_username_live_key"
  ON "User" ("tenantId", "username")
  WHERE "deletedAt" IS NULL;

-- Prisma still models these pairs as plain indexes so findFirst stays fast.
CREATE INDEX IF NOT EXISTS "User_tenantId_email_idx" ON "User" ("tenantId", "email");
CREATE INDEX IF NOT EXISTS "User_tenantId_username_idx" ON "User" ("tenantId", "username");

-- 3. Serves the default listing and its default `name asc` sort in one index.
CREATE INDEX "User_tenantId_deletedAt_name_idx"
  ON "User" ("tenantId", "deletedAt", "name");
```

- [ ] **Step 5: Apply the migration and regenerate the client**

Run from the repo root, using the **superuser** `DATABASE_URL` from the PC `.env` (the Oracle `.env` is DML-only):

```bash
pnpm --filter @greatsales/db exec prisma migrate dev --name f12_users_roles_teams
```

Expected: migration applies, `@prisma/client` regenerates with `mustChangePassword`.

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @greatsales/db test migration.f12`
Expected: PASS — 4 tests

- [ ] **Step 7: Confirm no existing suite regressed**

Run: `pnpm --filter api test`
Expected: PASS — the previously green suite is still green (F1 reported 157).

- [ ] **Step 8: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations packages/db/prisma/migration.f12.spec.ts packages/db/package.json
git commit -m "feat(db): partial unique identity indexes and mustChangePassword"
```

---

### Task 3: Extend the seed fixture

**Files:**
- Modify: `packages/db/prisma/seed.ts:120-155`
- Test: `packages/db/prisma/seed.f12.spec.ts`

**Interfaces:**
- Consumes: Task 2's schema
- Produces (per tenant `k` ∈ {`acme`, `globex`}):
  - `user_admin2_<k>` — a **second** admin, so last-admin tests have somewhere to stand
  - `role_viewer_<k>` — a custom role with **zero users**, proving the role dropdown no longer depends on loaded rows
  - `team_secondary_<k>` — a second team for reassignment tests
  - `user_bulk_<k>_01` … `_12` — twelve sales users, so pagination and sorting are exercised with more than one page at `limit=10`

- [ ] **Step 1: Write the failing test**

Create `packages/db/prisma/seed.f12.spec.ts`:

```ts
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

beforeAll(() => {
  execSync("pnpm --filter @greatsales/db db:seed", { stdio: "ignore" });
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe.each(["acme", "globex"])("seed fixture for %s", (k) => {
  it("seeds a second admin so last-admin guards can be tested", async () => {
    const admins = await prisma.user.findMany({
      where: { tenantId: `tenant_${k}`, roleId: `role_admin_${k}`, deletedAt: null, active: true },
    });
    expect(admins.length).toBeGreaterThanOrEqual(2);
  });

  it("seeds a custom role with no users", async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { id: `role_viewer_${k}` } });
    expect(role.isSystem).toBe(false);
    expect(await prisma.user.count({ where: { roleId: role.id } })).toBe(0);
  });

  it("seeds a second team", async () => {
    await expect(
      prisma.team.findUniqueOrThrow({ where: { id: `team_secondary_${k}` } }),
    ).resolves.toBeDefined();
  });

  it("seeds enough users to force pagination", async () => {
    const count = await prisma.user.count({ where: { tenantId: `tenant_${k}`, deletedAt: null } });
    expect(count).toBeGreaterThanOrEqual(16);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @greatsales/db test seed.f12`
Expected: FAIL — `role_viewer_acme` not found

- [ ] **Step 3: Extend the seed**

In `packages/db/prisma/seed.ts`, immediately after the existing sales-user creation block (around line 150), insert:

```ts
  // --- F12 fixtures -------------------------------------------------------
  // A SECOND admin. Without one, every last-admin guard test would be forced
  // to construct its own, and the "cannot remove the last admin" rule could
  // never be exercised from a realistic starting state.
  await prisma.user.create({
    data: {
      id: `user_admin2_${k}`,
      tenantId: t,
      name: `${name} Admin Two`,
      email: `admin2@${k}.test`,
      username: `admin2_${k}`,
      passwordHash: PW,
      roleId: `role_admin_${k}`,
    },
  });

  // A custom role with NO users. Proves the role dropdown is sourced from
  // /roles and not from whichever roles happen to appear in the loaded rows.
  await prisma.role.create({
    data: { id: `role_viewer_${k}`, tenantId: t, name: "viewer", isSystem: false },
  });
  await prisma.rolePermission.createMany({
    data: ["customer.read", "report.view"].map((key) => ({
      roleId: `role_viewer_${k}`,
      permissionId: permId(key),
    })),
  });

  // A second team, so "move a member between teams" is testable.
  await prisma.team.create({
    data: {
      id: `team_secondary_${k}`,
      tenantId: t,
      name: `${name} Secondary Team`,
      managerId: `user_mgr_${k}`,
    },
  });

  // Twelve more sales users so a limit=10 page is genuinely partial and the
  // cursor/sort behaviour is exercised rather than assumed.
  await prisma.user.createMany({
    data: Array.from({ length: 12 }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return {
        id: `user_bulk_${k}_${n}`,
        tenantId: t,
        name: `${name} Bulk ${n}`,
        email: `bulk${n}@${k}.test`,
        username: `bulk${n}_${k}`,
        passwordHash: PW,
        roleId: `role_sales_${k}`,
        managerId: `user_mgr_${k}`,
        // Half active, half not, so the status filter has both sides to find.
        active: i % 2 === 0,
      };
    }),
  });
```

Also add `"Role"` cleanup ordering is already correct in the TRUNCATE list (line 68) — no change needed there.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @greatsales/db test seed.f12`
Expected: PASS — 8 tests (4 × 2 tenants)

- [ ] **Step 5: Confirm the existing suites still pass against the bigger fixture**

Run: `pnpm --filter api test`
Expected: PASS. **`users.service.spec.ts` will now fail** on `expect(res.items).toHaveLength(4)` — that assertion counted the old fixture. Update it to assert the specific users it cares about rather than a raw length:

```ts
    const emails = res.items.map((u) => u.email);
    expect(emails).toEqual(expect.arrayContaining(["admin@acme.test", "sales1@acme.test"]));
```

Rerun until green.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/seed.ts packages/db/prisma/seed.f12.spec.ts apps/api/src/users/users.service.spec.ts
git commit -m "test(db): seed second admin, empty role, second team, bulk users"
```

---

## Phase 1 — Auth prerequisites

### Task 4: Extract `revokeAllForUser`

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts:279-320`
- Modify: `apps/api/src/auth/auth.module.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `AuthService.revokeAllForUser(db: TenantClient, userId: string, reason: string): Promise<number>` — public, callable from `UsersService` inside an existing transaction. `TenantClient` is the return type of `PrismaService.forTenant`; export a `type TenantClient = ReturnType<PrismaService['forTenant']>` from `prisma.service.ts` if one does not already exist.
- `AuthModule` adds `exports: [AuthService]`.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/auth/auth.service.spec.ts`:

```ts
describe('revokeAllForUser', () => {
  it('revokes every live family for the user and returns the count', async () => {
    const a = await service.login({ ...CREDS }, {});
    const b = await service.login({ ...CREDS }, {});
    expect(a.refreshTokenValue).not.toBe(b.refreshTokenValue);

    const db = prisma.forTenant('tenant_acme');
    const revoked = await service.revokeAllForUser(db, 'user_admin_acme', 'admin_deactivated');
    expect(revoked).toBeGreaterThanOrEqual(2);

    await expect(service.refresh(a.refreshTokenValue, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.refresh(b.refreshTokenValue, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('records the caller-supplied reason, so an operator can see why', async () => {
    await service.login({ ...CREDS }, {});
    const db = prisma.forTenant('tenant_acme');
    await service.revokeAllForUser(db, 'user_admin_acme', 'admin_password_reset');

    const row = await db.refreshToken.findFirst({
      where: { userId: 'user_admin_acme', revokedReason: 'admin_password_reset' },
    });
    expect(row).not.toBeNull();
  });

  it('is idempotent — revoking twice returns zero the second time', async () => {
    await service.login({ ...CREDS }, {});
    const db = prisma.forTenant('tenant_acme');
    await service.revokeAllForUser(db, 'user_admin_acme', 'admin_deleted');
    expect(await service.revokeAllForUser(db, 'user_admin_acme', 'admin_deleted')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test auth.service -t revokeAllForUser`
Expected: FAIL — `service.revokeAllForUser is not a function`

- [ ] **Step 3: Extract the helper**

In `apps/api/src/auth/auth.service.ts`, add the public method (place it beside `revokeFamily`):

```ts
  /**
   * Revoke EVERY live refresh family belonging to one user.
   *
   * Takes the tenant-bound client as a parameter rather than creating its own,
   * so an administrative write (deactivate, delete, password reset) can revoke
   * inside its own transaction — an audit row, the mutation, and the
   * revocation all commit or all roll back together.
   *
   * `reason` is stored on each row so an operator can tell from the data why a
   * session ended: admin_deactivated, admin_deleted, admin_password_reset,
   * role_changed, self_password_change, logout_all.
   */
  async revokeAllForUser(
    db: TenantClient,
    userId: string,
    reason: string,
  ): Promise<number> {
    const res = await db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return res.count;
  }
```

Then rewrite the `logout(all)` branch (currently lines 286-297) to call it, so there is one implementation:

```ts
    if (allSessions) {
      const revoked = await this.revokeAllForUser(db, principal.userId, 'logout_all');
      this.event('logout.all', ctx, { userId: principal.userId, tenantId: principal.tenantId, revoked });
      return { revoked };
    }
```

In `apps/api/src/prisma/prisma.service.ts`, export the client type if absent:

```ts
/** The tenant-bound client returned by {@link PrismaService.forTenant}. */
export type TenantClient = ReturnType<PrismaService['forTenant']>;

/**
 * The client handed to an interactive `$transaction` callback on a tenant-bound
 * client. Same models, minus the nested-transaction methods. Guards and audit
 * helpers take THIS type, so they can only be called from inside a transaction
 * — which is what makes their locking meaningful.
 */
export type TenantTx = Omit<TenantClient, '$transaction' | '$connect' | '$disconnect'>;
```

In `apps/api/src/auth/auth.module.ts`, add `exports: [AuthService]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test auth.service`
Expected: PASS — the 55 existing auth tests plus 3 new ones

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts apps/api/src/auth/auth.module.ts apps/api/src/prisma/prisma.service.ts
git commit -m "refactor(auth): extract revokeAllForUser and export AuthService"
```

---

### Task 5: `POST /auth/change-password`

**Files:**
- Modify: `packages/shared/src/auth.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Test: `apps/api/src/auth/auth.change-password.spec.ts`

**Interfaces:**
- Consumes: `validatePassword` (Task 1), `revokeAllForUser` (Task 4)
- Produces:
  - `ChangePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string() })`
  - `AuthService.changePassword(principal: RequestUser, input: ChangePasswordInput, currentFamilyId: string | null, ctx: AuthContext): Promise<{ revoked: number }>`
  - Route `POST /auth/change-password` → 200 `{ revoked: number }`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/auth/auth.change-password.spec.ts`:

```ts
import '../load-env';
import { execSync } from 'node:child_process';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { verifyPassword } from './hash';
import type { RequestUser } from '@greatsales/shared';

const CREDS = { tenantId: 'tenant_acme', email: 'admin@acme.test', password: 'Passw0rd!' };
const PRINCIPAL: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: 'tenant_acme',
  roleId: 'role_admin_acme',
};
const GOOD_NEW = 'towel-forty-two-vogon';

let prisma: PrismaService;
let service: AuthService;

beforeEach(async () => {
  execSync('pnpm --filter @greatsales/db db:seed', { cwd: process.cwd(), stdio: 'ignore' });
}, 120_000);

beforeAll(async () => {
  prisma = new PrismaService(process.env.DATABASE_URL as string);
  await prisma.onModuleInit();
  service = new AuthService(prisma, new JwtService({}), new ConfigService());
}, 120_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
});

describe('AuthService.changePassword', () => {
  it('rejects a wrong current password without changing anything', async () => {
    await expect(
      service.changePassword(PRINCIPAL, { currentPassword: 'nope', newPassword: GOOD_NEW }, null, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const u = await prisma.forTenant('tenant_acme').user.findUniqueOrThrow({
      where: { id: PRINCIPAL.userId },
    });
    expect(await verifyPassword(u.passwordHash, CREDS.password)).toBe(true);
  });

  it('rejects a new password that fails the shared policy', async () => {
    await expect(
      service.changePassword(
        PRINCIPAL,
        { currentPassword: CREDS.password, newPassword: 'short' },
        null,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a new password containing the user identity', async () => {
    await expect(
      service.changePassword(
        PRINCIPAL,
        { currentPassword: CREDS.password, newPassword: 'xx-admin_acme-xxxx' },
        null,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores a real argon2 hash of the new password', async () => {
    await service.changePassword(
      PRINCIPAL,
      { currentPassword: CREDS.password, newPassword: GOOD_NEW },
      null,
      {},
    );
    const u = await prisma.forTenant('tenant_acme').user.findUniqueOrThrow({
      where: { id: PRINCIPAL.userId },
    });
    expect(u.passwordHash).not.toBe(GOOD_NEW);
    expect(await verifyPassword(u.passwordHash, GOOD_NEW)).toBe(true);
    expect(await verifyPassword(u.passwordHash, CREDS.password)).toBe(false);
  });

  it('clears mustChangePassword', async () => {
    const db = prisma.forTenant('tenant_acme');
    await db.user.update({ where: { id: PRINCIPAL.userId }, data: { mustChangePassword: true } });

    await service.changePassword(
      PRINCIPAL,
      { currentPassword: CREDS.password, newPassword: GOOD_NEW },
      null,
      {},
    );
    const u = await db.user.findUniqueOrThrow({ where: { id: PRINCIPAL.userId } });
    expect(u.mustChangePassword).toBe(false);
  });

  it('revokes OTHER sessions but keeps the calling session alive', async () => {
    const other = await service.login({ ...CREDS }, {});
    const mine = await service.login({ ...CREDS }, {});
    const myFamily = decodeFamily(mine.refreshTokenValue);

    await service.changePassword(
      PRINCIPAL,
      { currentPassword: CREDS.password, newPassword: GOOD_NEW },
      myFamily,
      {},
    );

    await expect(service.refresh(other.refreshTokenValue, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.refresh(mine.refreshTokenValue, {})).resolves.toBeDefined();
  });
});

/** Reads `fid` out of a refresh JWT without verifying — test-only helper. */
function decodeFamily(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  return payload.fid as string;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test auth.change-password`
Expected: FAIL — `service.changePassword is not a function`

- [ ] **Step 3: Add the schema**

In `packages/shared/src/auth.ts`:

```ts
/** POST /auth/change-password. The policy is applied server-side, not here. */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
```

- [ ] **Step 4: Implement the service method**

In `apps/api/src/auth/auth.service.ts`:

```ts
  /**
   * Change the caller's own password.
   *
   * Requires the current password — an access token alone must not be enough,
   * because a stolen token would otherwise let an attacker take over the
   * account permanently. Every OTHER session is revoked; the calling session
   * survives so the user is not signed out of the tab they are using.
   *
   * `currentFamilyId` is the family the caller presented. Null (a native
   * client with no cookie) means every family is revoked, including theirs.
   */
  async changePassword(
    principal: RequestUser,
    input: ChangePasswordInput,
    currentFamilyId: string | null,
    ctx: AuthContext = {},
  ): Promise<{ revoked: number }> {
    const db = this.prisma.forTenant(principal.tenantId);

    const user = await db.user.findFirst({
      where: { id: principal.userId, deletedAt: null, active: true },
    });
    if (!user) {
      this.event('change_password.user_not_active', ctx, { userId: principal.userId });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      this.event('change_password.wrong_current', ctx, {
        userId: principal.userId,
        tenantId: principal.tenantId,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const check = validatePassword(input.newPassword, {
      name: user.name,
      email: user.email,
      username: user.username,
    });
    if (!check.ok) {
      throw new BadRequestException({
        error: 'ValidationError',
        code: 'WEAK_PASSWORD' satisfies ErrorCode,
        message: PASSWORD_FAILURE_MESSAGE[check.reason],
      });
    }

    const newHash = await hashPassword(input.newPassword);

    // One transaction: the credential change and the session revocation must
    // not be separable. A crash between them would leave old sessions live on
    // a password the user believes they have already replaced.
    const revoked = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: principal.userId },
        data: { passwordHash: newHash, mustChangePassword: false },
      });
      const res = await tx.refreshToken.updateMany({
        where: {
          userId: principal.userId,
          revokedAt: null,
          ...(currentFamilyId ? { familyId: { not: currentFamilyId } } : {}),
        },
        data: { revokedAt: new Date(), revokedReason: 'self_password_change' },
      });
      return res.count;
    });

    this.event('change_password.succeeded', ctx, {
      userId: principal.userId,
      tenantId: principal.tenantId,
      revoked,
    });
    return { revoked };
  }
```

Add the imports it needs: `validatePassword`, `PASSWORD_FAILURE_MESSAGE`, `type ErrorCode`, `type ChangePasswordInput` from `@greatsales/shared`; `BadRequestException` from `@nestjs/common`; `hashPassword` from `./hash`.

- [ ] **Step 5: Add the controller route**

In `apps/api/src/auth/auth.controller.ts`, mirroring how `logout` reads the refresh cookie:

```ts
  /**
   * Change your own password. Authenticated (the global JWT guard applies) and
   * additionally proves knowledge of the current password.
   */
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) body: ChangePasswordInput,
    @Req() req: Request,
  ) {
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const familyId = cookie ? this.auth.familyIdFromToken(cookie) : null;
    return this.auth.changePassword(user, body, familyId, {
      ip: req.ip,
      requestId: req.headers['x-request-id'] as string | undefined,
    });
  }
```

Add the small public helper to `AuthService` (it already decodes refresh claims internally):

```ts
  /** Best-effort family id from a presented refresh token. Null if unreadable. */
  familyIdFromToken(token: string): string | null {
    try {
      const claims = this.jwt.verify<JwtRefreshClaims>(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      return claims.typ === 'refresh' ? (claims.fid ?? null) : null;
    } catch {
      // Unreadable token identifies no family; the caller then revokes all.
      return null;
    }
  }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter api test auth.change-password`
Expected: PASS — 6 tests

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/auth.ts apps/api/src/auth/
git commit -m "feat(auth): add POST /auth/change-password with session revocation"
```

---

### Task 6: `/auth/me` returns permissions and `mustChangePassword`

**Files:**
- Modify: `packages/shared/src/auth.ts:50-59`
- Modify: `apps/api/src/auth/auth.service.ts` (`me`, ~line 324)
- Test: `apps/api/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `AuthUser` gains `permissions: string[]` and `mustChangePassword: boolean`. Additive only — existing consumers are unaffected (AGENTS.md §23).

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/auth/auth.service.spec.ts`:

```ts
describe('me — permissions and password state', () => {
  it('returns the admin role\'s full permission set', async () => {
    const me = await service.me({
      userId: 'user_admin_acme',
      tenantId: 'tenant_acme',
      roleId: 'role_admin_acme',
    });
    expect(me.permissions).toEqual(expect.arrayContaining(['user.manage', 'role.manage']));
    expect(me.mustChangePassword).toBe(false);
  });

  it('returns a sales role\'s restricted set, without user.manage', async () => {
    const me = await service.me({
      userId: 'user_sales1_acme',
      tenantId: 'tenant_acme',
      roleId: 'role_sales_acme',
    });
    expect(me.permissions).toEqual(expect.arrayContaining(['customer.write']));
    expect(me.permissions).not.toContain('user.manage');
    expect(me.permissions).not.toContain('role.manage');
  });

  it('reports mustChangePassword when the flag is set', async () => {
    const db = prisma.forTenant('tenant_acme');
    await db.user.update({ where: { id: 'user_sales2_acme' }, data: { mustChangePassword: true } });
    const me = await service.me({
      userId: 'user_sales2_acme',
      tenantId: 'tenant_acme',
      roleId: 'role_sales_acme',
    });
    expect(me.mustChangePassword).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test auth.service -t "permissions and password state"`
Expected: FAIL — `me.permissions` is `undefined`

- [ ] **Step 3: Extend the schema**

In `packages/shared/src/auth.ts`:

```ts
export const AuthUserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  email: z.string(),
  username: z.string(),
  roleId: z.string(),
  role: z.string().nullable(),
  /**
   * The caller's resolved permission keys. The web uses these to decide which
   * controls to render; the server still enforces every one of them
   * independently (AGENTS.md §7).
   */
  permissions: z.array(z.string()),
  /** True while an admin-set password has not yet been replaced by the user. */
  mustChangePassword: z.boolean(),
});
```

- [ ] **Step 4: Extend `me()`**

In `apps/api/src/auth/auth.service.ts`, change the `me` query to include the role's permissions and return the two new fields:

```ts
  async me(principal: RequestUser): Promise<AuthUser> {
    const db = this.prisma.forTenant(principal.tenantId);
    const user = await db.user.findFirst({
      where: { id: principal.userId, deletedAt: null },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      username: user.username,
      roleId: user.roleId,
      role: user.role?.name ?? null,
      permissions: user.role?.permissions.map((rp) => rp.permission.key) ?? [],
      mustChangePassword: user.mustChangePassword,
    };
  }
```

Apply the same two fields wherever `login()` builds its `user` payload, so a fresh sign-in and a `/auth/me` agree.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter api test auth`
Expected: PASS — all auth suites

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/auth.ts apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts
git commit -m "feat(auth): return permissions and mustChangePassword from login and me"
```

---

### Task 7: `MustChangePasswordGuard`

**Files:**
- Create: `apps/api/src/common/must-change-password.guard.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/common/all-exceptions.filter.ts`
- Create: `apps/api/src/common/error-codes.ts`
- Test: `apps/api/test/auth.e2e-spec.ts` (extend)

**Interfaces:**
- Consumes: Task 6's `mustChangePassword`
- Produces:
  - `codedConflict(code, message)`, `codedBadRequest(code, message)`, `codedNotFound(code, message)` from `common/error-codes.ts`
  - Global `MustChangePasswordGuard`, registered after `JwtAuthGuard` and before `PermissionsGuard`
  - `@AllowPasswordChangePending()` decorator marking the three escape-hatch routes

- [ ] **Step 1: Write the failing test**

Append to `apps/api/test/auth.e2e-spec.ts`:

```ts
describe('mustChangePassword gate', () => {
  /** Flags a seeded user, signs them in, and returns their access token. */
  async function flaggedSession() {
    const prisma = app.get(PrismaService);
    await prisma
      .forTenant('tenant_acme')
      .user.update({ where: { id: 'user_admin2_acme' }, data: { mustChangePassword: true } });

    const res = await client()
      .login({ tenantId: 'tenant_acme', email: 'admin2@acme.test', password: 'Passw0rd!' })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('blocks a normal endpoint with 403 PASSWORD_CHANGE_REQUIRED', async () => {
    const token = await flaggedSession();
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('still allows /auth/me, so the client can discover why it is blocked', async () => {
    const token = await flaggedSession();
    const res = await client().me(token).expect(200);
    expect(res.body.mustChangePassword).toBe(true);
  });

  it('still allows /auth/change-password, the only way out', async () => {
    const token = await flaggedSession();
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Passw0rd!', newPassword: 'towel-forty-two-vogon' })
      .expect(200);
  });

  it('unblocks every endpoint once the password has been changed', async () => {
    const token = await flaggedSession();
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Passw0rd!', newPassword: 'towel-forty-two-vogon' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test:e2e auth`
Expected: FAIL — the first test gets 200, not 403

- [ ] **Step 3: Add the coded-error helpers**

Create `apps/api/src/common/error-codes.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ErrorCode } from '@greatsales/shared';

/**
 * Throw helpers that guarantee every deliberate failure carries a stable
 * machine-readable `code`. Clients branch on the code; the message is for
 * humans and may be reworded freely.
 */
export const codedBadRequest = (code: ErrorCode, message: string) =>
  new BadRequestException({ error: 'ValidationError', code, message });

export const codedConflict = (code: ErrorCode, message: string) =>
  new ConflictException({ error: 'Conflict', code, message });

export const codedNotFound = (code: ErrorCode, message: string) =>
  new NotFoundException({ error: 'NotFound', code, message });

export const codedForbidden = (code: ErrorCode, message: string) =>
  new ForbiddenException({ error: 'Forbidden', code, message });
```

- [ ] **Step 4: Pass `code` through the envelope**

In `apps/api/src/common/all-exceptions.filter.ts`, inside the `HttpException` object branch, after `error = ...`:

```ts
        code = body.code as ErrorCode | undefined;
```

Declare `let code: ErrorCode | undefined;` beside the other locals, and add `code,` to the `payload` object. Import `type ErrorCode` from `@greatsales/shared`.

- [ ] **Step 5: Write the guard**

Create `apps/api/src/common/must-change-password.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { codedForbidden } from './error-codes';

/**
 * Marks the few routes a user with a pending forced password change may still
 * call: discovering their own state, changing the password, and signing out.
 */
export const ALLOW_PENDING_KEY = 'allowPasswordChangePending';
export const AllowPasswordChangePending = () => SetMetadata(ALLOW_PENDING_KEY, true);

/**
 * Enforces the forced-password-change state SERVER-SIDE.
 *
 * `mustChangePassword` is returned to the client so the UI can route the user
 * to the change screen, but a client that ignores it must not get data. This
 * guard is that enforcement. It runs after JwtAuthGuard (so req.user exists)
 * and before PermissionsGuard (a user who must change their password should
 * not even reach a permission check).
 *
 * Cost: one indexed primary-key read per request for flagged users only —
 * the common path short-circuits on the access token's own claim, and the DB
 * read confirms it so a stale token cannot outlive the flag being set.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (allowed) return true;

    const user: RequestUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) return true; // unauthenticated or public — not this guard's concern

    const row = await this.prisma.forTenant(user.tenantId).user.findFirst({
      where: { id: user.userId },
      select: { mustChangePassword: true },
    });
    if (row?.mustChangePassword) {
      throw codedForbidden(
        'PASSWORD_CHANGE_REQUIRED',
        'You must change your password before continuing.',
      );
    }
    return true;
  }
}
```

- [ ] **Step 6: Register it and mark the escape hatches**

In `apps/api/src/app.module.ts`, add to `providers`, immediately **after** the existing `JwtAuthGuard` `APP_GUARD` entry (Nest applies global guards in registration order):

```ts
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
```

In `apps/api/src/auth/auth.controller.ts`, decorate `me`, `changePassword`, and `logout` with `@AllowPasswordChangePending()`.

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter api test:e2e auth`
Expected: PASS — the 28 existing e2e tests plus 4 new ones

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/common/ apps/api/src/app.module.ts apps/api/src/auth/auth.controller.ts apps/api/test/auth.e2e-spec.ts
git commit -m "feat(auth): enforce forced password change server-side"
```

---

## Phase 2 — Users API

> **Fidelity note.** Phases 0-1 carry full implementation code because they establish
> patterns (coded errors, transaction shape, audit redaction) that everything after reuses.
> From here the plan specifies *files, interfaces, and the exact test cases* — implementation
> follows the established patterns and is written at execution time. Every task still has a
> failing test first, and no task is complete until its named tests pass.

### Task 8: Fix the list contract — status, sort, total, teamId, includeDeleted

**Files:**
- Modify: `packages/shared/src/user.ts`
- Modify: `apps/api/src/users/users.service.ts:56-90` (`list`)
- Test: `apps/api/src/users/users.service.spec.ts`

**Interfaces produced:**
```ts
export const UserStatusFilter = z.enum(["all", "active", "inactive"]);
export const UserSortField = z.enum(["name","email","username","createdAt","lastLoginAt"]);
export const BoolFlag = z.enum(["true", "false"]);
export const UserListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  roleId: z.string().optional(),
  teamId: z.string().optional(),
  status: UserStatusFilter.default("all"),
  sort: UserSortField.default("name"),
  dir: z.enum(["asc","desc"]).default("asc"),
  includeDeleted: BoolFlag.default("false"),
});
export interface UserListResponse { items: UserRow[]; nextCursor: string | null; total: number }
// UserRow gains: mustChangePassword: boolean; deletedAt: string | null
// users.service.ts exports: buildUserWhere(query: UserListQuery): Prisma.UserWhereInput
```

**Why an enum, not `z.coerce.boolean()`:** `z.coerce.boolean()` maps the *string* `"false"` to
`true`, so `?active=false` returned ACTIVE users. Confirmed by running zod 3.25.76 directly.
An enum has no coercion to get wrong.

**Implementation shape:** `list()` reads the page and the count inside **one**
`db.$transaction([findMany, count])` so the header total cannot disagree with the rows.
`orderBy` is `[{ [sort]: dir }, { id: dir }]` — a secondary key on `id` makes the order total
even when the sort column ties, which keyset pagination requires. `buildUserWhere` is extracted
so the page filter and the count filter are literally the same object.

- [ ] **Step 1: Write the failing tests** in `describe('list — filtering, sorting, pagination')`:

| Test | Asserts |
| --- | --- |
| reports a total counting ALL matches, not the page | `limit:5` → `items.length === 5`, `total > 5`, `nextCursor !== null` |
| `status=inactive` returns ONLY inactive users | `items.length > 0 && items.every(u => !u.active)` — **the A1 regression** |
| `status=active` returns ONLY active users | `items.every(u => u.active)` |
| `status=all` returns both | some active, some not |
| sorts by name ascending by default | `names === [...names].sort(localeCompare)` |
| sorts by name descending when asked | reverse of the above |
| pages without dropping or repeating a row | walk all pages at `limit:5`; `new Set(ids).size === ids.length` and `ids.length === total` |
| filters by `teamId` | `items.every(u => u.teamId === 'team_acme')` |
| hides soft-deleted by default, shows on request | create → remove → absent with `includeDeleted:'false'`, present with `'true'` and `deletedAt !== null` |
| never leaks a password hash in any row | no `passwordHash` key; `JSON.stringify(row)` does not match `/\$argon2/` |

- [ ] **Step 2:** `pnpm --filter api test users.service -t "filtering, sorting, pagination"` → FAIL (`total` undefined)
- [ ] **Step 3:** Rewrite the shared query contract and `list()` as above; extend `toRow` with the two new fields.
- [ ] **Step 4:** Rerun → PASS
- [ ] **Step 5:** `git commit -m "fix(users): replace broken active coercion with a status enum; add total, sort, teamId"`

---

### Task 9: Server-side normalisation, password policy, coded Prisma errors

**Files:**
- Create: `apps/api/src/users/user-invariants.ts`
- Modify: `apps/api/src/users/users.service.ts` (`create`, `update`)
- Test: `apps/api/src/users/users.service.spec.ts`

**Interfaces produced:**
```ts
export function normalizeIdentity<T extends {email?:string; username?:string; name?:string}>(i: T): T;
export function assertPasswordPolicy(plain: string, identity: PasswordIdentity): void; // throws WEAK_PASSWORD 400
export function mapPrismaWriteError(e: unknown): never; // P2002→DUPLICATE_IDENTITY 409, P2025|P2003→INVALID_REFERENCE 400
```

**Implementation notes:**
- `normalizeIdentity` trims + lower-cases `email`/`username`, trims `name`. Case is not
  identity; without this `Admin@x` and `admin@x` are two accounts and the partial unique index
  cannot tell them apart either. Client-side lower-casing is advice, not enforcement.
- `mapPrismaWriteError`: P2025 is what a nested `connect` to a non-existent — or cross-tenant,
  which RLS makes indistinguishable — role/manager/team raises. It surfaced as a 500.
- `create` now sets `mustChangePassword: true`: an admin-chosen password is a shared secret the
  moment it is typed.
- Delete the now-unused `isUniqueViolation` helper.

- [ ] **Step 1: Write the failing tests** in `describe('input hygiene')`:

| Test | Asserts |
| --- | --- |
| lower-cases and trims email/username server-side | `'  MiXeD@Acme.TEST '` → `'mixed@acme.test'`; name trimmed |
| a differently-cased email is a duplicate | `'ADMIN@ACME.TEST'` → `code: 'DUPLICATE_IDENTITY'` |
| rejects a password below the policy minimum | `'short1234'` → `code: 'WEAK_PASSWORD'` |
| rejects a password containing the new user's own username | `'xx-selfyuser-xxxx'` for username `selfyuser` → `WEAK_PASSWORD` |
| unknown `roleId` → 400 `INVALID_REFERENCE`, not 500 | `status: 400` |
| **cross-tenant** `roleId` (`role_sales_globex`) → 400 `INVALID_REFERENCE` | proves RLS makes it indistinguishable from missing |
| unknown `teamId` → 400 `INVALID_REFERENCE` | |
| the same policy applies on update | `update(..., { password: '123456' })` → `WEAK_PASSWORD` |

- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** implement
- [ ] **Step 4:** rerun → PASS. The pre-existing `'rejects a duplicate email'` test still passes because `codedConflict` returns a `ConflictException`.
- [ ] **Step 5:** `git commit -m "feat(users): normalise identity, enforce password policy, map Prisma errors to codes"`

---

### Task 10: Manager validation and cycle detection (I3)

**Files:**
- Modify: `apps/api/src/users/user-invariants.ts`
- Modify: `apps/api/src/users/users.service.ts` (`create`, `update`)
- Test: `apps/api/src/users/users.service.spec.ts`

**Interfaces produced:**
```ts
export const MAX_MANAGER_DEPTH = 64;
export async function assertManagerAcyclic(
  db: TenantClient, userId: string | null, managerId: string,
): Promise<void>; // throws INVALID_MANAGER 400
```

**Why this cannot be a database constraint:** a cycle is not cosmetic — any code that walks the
reporting chain (team rollups, approval routing, "my reports") would loop forever. Postgres
cannot express "this FK must not close a cycle", so it is enforced in the transaction.

**Algorithm:** walk **up** from the proposed manager. Reject if `managerId === userId`, if the
manager is not found under the RLS-bound client with `deletedAt: null, active: true` (which
covers cross-tenant, deleted, and inactive in one condition), if `userId` appears anywhere on
the upward path, or if the walk exceeds `MAX_MANAGER_DEPTH`. A dangling parent is not a cycle —
return cleanly.

- [ ] **Step 1: Write the failing tests** in `describe('manager graph (I3)')`:

| Test | Asserts |
| --- | --- |
| rejects a user managing themselves | `INVALID_MANAGER` 400 |
| rejects a two-node cycle | `mgr → sales1` when `sales1 → mgr` already |
| rejects a three-node cycle | A→B→C, then C as A's manager |
| **accepts a legitimate deep chain** | proves it rejects cycles, not depth |
| rejects a manager from another tenant | `user_mgr_globex` → `INVALID_MANAGER` |
| rejects a soft-deleted manager | create → remove → assign → `INVALID_MANAGER` |
| allows clearing the manager | `{ managerId: null }` → `managerId === null` |

- [ ] **Step 2:** run → FAIL (self-management succeeds)
- [ ] **Step 3:** implement; call from `create` (`if (body.managerId)`) and `update` (`if (patch.managerId)`)
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(users): validate manager assignment and reject reporting cycles"`

---

### Task 11: Self-mutation and last-admin guards (I1, I2)

**Files:**
- Modify: `apps/api/src/users/user-invariants.ts`
- Modify: `apps/api/src/users/users.service.ts` (`update`, `remove` → transactions)
- Test: `apps/api/src/users/users.service.spec.ts`
- Create: `apps/api/src/users/users.concurrency.spec.ts`

**Interfaces produced:**
```ts
export const ADMIN_PERMISSION = 'user.manage';
export function assertNotSelfDangerous(
  actorId: string, targetId: string,
  patch: Partial<Record<'active'|'roleId', unknown>>, isDeleting?: boolean,
): void; // throws SELF_MUTATION_FORBIDDEN 409
export async function assertNotLastAdmin(
  tx: TenantTx, targetUserId: string,
  next: { roleId?: string | null; active?: boolean; deleting?: boolean },
): Promise<void>; // throws LAST_ADMIN_PROTECTED 409
```

**Why inside the transaction with `FOR UPDATE`:** two admins deleting each other simultaneously
would each read "one other admin remains" and both commit, leaving zero. The guard locks the
surviving-admin candidate set with `SELECT … FOR UPDATE OF u`, so the two requests serialise
and the second sees the first's effect.

`assertNotSelfDangerous` allows harmless self-edits (name, email) and blocks only `active`,
`roleId`, and delete — the three that strip your own administrative access.

`assertNotLastAdmin` computes whether the target still holds `user.manage` **after** the
proposed write, so one function covers deactivate, delete, and demote. The candidate query
joins `User → RolePermission → Permission` filtered to `active = true AND deletedAt IS NULL`.
`Permission` is a global table with no RLS; `User` and `Role` are filtered by the transaction's
`app.tenant_id`.

**Restructure required:** `update` and `remove` move inside `db.$transaction(async (tx) => …)`.
Argon2 hashing (~50 ms) happens **before** the transaction opens so it never holds a row lock.
The long field-mapping block in `update` lifts out to a module-scope `buildUpdateData(patch, hashed)`.

- [ ] **Step 1a: Write the failing tests** in `describe('administrative access protection (I1, I2)')`:

| Test | Asserts |
| --- | --- |
| refuses to deactivate your own account | `SELF_MUTATION_FORBIDDEN` 409 |
| refuses to delete your own account | `SELF_MUTATION_FORBIDDEN` 409 |
| refuses to change your own role | `SELF_MUTATION_FORBIDDEN` 409 |
| **ALLOWS editing your own name** | not every self-edit is dangerous |
| allows deactivating the second admin while one remains | resolves |
| refuses to deactivate the LAST admin | deactivate admin2 first, then `LAST_ADMIN_PROTECTED` |
| refuses to DELETE the last admin | `LAST_ADMIN_PROTECTED` |
| refuses to DEMOTE the last admin to a role without `user.manage` | `LAST_ADMIN_PROTECTED` |
| counts only ACTIVE, NON-DELETED admins as cover | a soft-deleted spare admin does not count |

- [ ] **Step 1b: Write `users.concurrency.spec.ts`** — one test:
  `Promise.allSettled([remove(admin2 → admin1), remove(admin1 → admin2)])` →
  exactly one `fulfilled`, and `count({ roleId: 'role_admin_acme', active: true, deletedAt: null }) === 1`.
  `beforeEach` reseeds so the two-admin starting state is exact. Timeout 60 s.
- [ ] **Step 2:** `pnpm --filter api test users` → FAIL (self-deactivation succeeds; concurrency leaves 0 admins)
- [ ] **Step 3:** implement the guards and restructure `update`/`remove`
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(users): guard self-lockout and last-admin removal under concurrency"`

---

### Task 12: Audit logging and session revocation

**Files:**
- Create: `apps/api/src/users/users.audit.ts`
- Modify: `apps/api/src/users/users.service.ts` (inject `AuthService`), `users.module.ts` (`imports: [AuthModule]`)
- Test: `apps/api/src/users/users.audit.spec.ts`

**Interfaces produced:**
```ts
export type UserAuditAction =
  | 'user.created' | 'user.updated' | 'user.deleted' | 'user.restored' | 'user.password_reset';
export function redactUser(row: unknown): unknown;
export async function auditUser(
  tx: TenantTx, actor: RequestUser, action: UserAuditAction,
  entityId: string, before: unknown, after: unknown,
): Promise<void>;
```

**`redactUser` is a KEY-NAME filter** (`/password|secret|token|hash/i`), not a list of known
fields — a future `tempPassword` or `passwordResetToken` column is caught automatically instead
of leaking until someone notices.

**`auditUser` takes the transaction client**, never the service's own: AGENTS.md §25 is
unsatisfiable if a failed write can leave an audit claiming it happened, or a successful write
can leave no trace.

**Structured logging (spec §10).** Alongside the audit row, each mutation emits one log line
through the same `Logger` pattern `auth.service.ts` uses for its events:
`{ event: "user.deactivated", requestId, tenantId, actorId, targetId, outcome }`. A refused
invariant logs at `warn` with its code, so an operator can see that someone repeatedly tried to
delete the last admin. No password, hash, or token ever appears. Add one test asserting a denied
last-admin deletion produces a `warn` carrying `LAST_ADMIN_PROTECTED`.

**Revocation reasons** (stored on `RefreshToken.revokedReason` so an operator can see *why* a
session ended): `admin_deactivated`, `admin_deleted`, `admin_password_reset`, `role_changed`.
Role change revokes because the **access token carries `roleId`** — a demoted user would
otherwise keep the old role's permissions until it expired.

- [ ] **Step 1: Write `users.audit.spec.ts`.** Two describes.

`describe('user audit trail')`:

| Test | Asserts |
| --- | --- |
| records a create with actor and resulting state | `action: 'user.created'`, `userId === actor`, `before === null`, `after` matches email |
| records an update with BOTH previous and new value | `before.name` old, `after.name` new |
| records a delete and a restore | actions in order: created, deleted, restored |
| **NEVER writes a password or hash** | for every row, `JSON.stringify({before,after})` fails `/password/i`, `/\$argon2/`, and does not contain any of the three plaintexts used |
| rolls the audit row back with the write | a refused self-deactivation leaves the audit count unchanged — **no orphan audit** |

`describe('session revocation on administrative writes')` — helper `live(userId)` counts
`refreshToken` rows with `revokedAt: null`:

| Test | Asserts |
| --- | --- |
| revokes on deactivate | `live → 0` |
| revokes on delete | `live → 0` |
| revokes on password reset | `live → 0` |
| revokes on ROLE change | `live → 0` |
| **leaves an unrelated user's sessions alone** | sales2 still `> 0` after sales1 is deactivated |

- [ ] **Step 2:** run → FAIL (no audit rows; `restore`/`resetPassword` not yet defined)
- [ ] **Step 3:** implement `users.audit.ts`; wire `auditUser` + `revokeAllForUser` into each transaction
- [ ] **Step 4:** run the audit-trail describe → PASS. The revocation describe fully passes after Task 13.
- [ ] **Step 5:** `git commit -m "feat(users): audit every mutation and revoke sessions on administrative writes"`

---

### Task 13: `GET /users/:id`, restore, reset-password

**Files:**
- Modify: `packages/shared/src/user.ts`, `apps/api/src/users/users.service.ts`, `users.controller.ts`
- Test: `apps/api/src/users/users.service.spec.ts`

**Interfaces produced:**
```ts
export const UserResetPasswordSchema = z.object({ password: z.string().min(1) });
class UsersService {
  get(user: RequestUser, id: string, includeDeleted: boolean): Promise<UserRow>;
  restore(user: RequestUser, id: string): Promise<UserRow>;
  resetPassword(user: RequestUser, id: string, body: UserResetPassword): Promise<{ mustChangePassword: true }>;
}
```
Routes: `GET /users/:id`, `POST /users/:id/restore`, `POST /users/:id/reset-password` (200).

**Route ordering:** `@Get(':id')` must be declared **after** `@Get()` — Nest matches in
declaration order and a bare `/users` would otherwise never reach the list handler.

**`resetPassword` refuses self-service** (`assertNotSelfDangerous(..., {}, true)`): changing
your own password belongs on `/auth/change-password`, which requires the current password.
Allowing it here would let a stolen access token take the account over permanently.

**`restore`** maps P2002 to `RESTORE_CONFLICT` 409 — the identity may have been re-taken while
the user was deleted, which is exactly what the partial unique index is there to catch.

- [ ] **Step 1: Write the failing tests** in `describe('get, restore, reset-password')`:

| Test | Asserts |
| --- | --- |
| gets one user by id | correct email, no `passwordHash` |
| 404s a cross-tenant user | `USER_NOT_FOUND` — must not confirm the id exists |
| 404s a soft-deleted user unless `includeDeleted` | 404 then resolves |
| restores a soft-deleted user | `deletedAt === null` and it reappears in the default list |
| refuses to restore onto a re-taken identity | `RESTORE_CONFLICT` 409 |
| resets a password, forces a change, echoes nothing | `{ mustChangePassword: true }`; `verifyPassword` true against the new one |
| applies the password policy on reset | `'qwerty'` → `WEAK_PASSWORD` |
| refuses to reset your OWN password here | `SELF_MUTATION_FORBIDDEN` |

- [ ] **Step 2:** run → FAIL (`service.get is not a function`)
- [ ] **Step 3:** implement the three methods and the three routes
- [ ] **Step 4:** `pnpm --filter api test users` → PASS, **including all of `users.audit.spec.ts`**
- [ ] **Step 5:** `git commit -m "feat(users): add get, restore, and admin password reset"`

---

### Task 14: Users HTTP e2e suite

**Files:** Create `apps/api/test/users.e2e-spec.ts`

Mirrors the bootstrap in `auth.e2e-spec.ts`: `AppModule`, `setGlobalPrefix('api/v1')`,
`cookieParser()`, `AllExceptionsFilter`, `trust proxy`. Signs in three principals —
`admin@acme.test`, `sales1@acme.test`, `manager@acme.test` — and exposes an `as(token)` helper.

The service specs prove the business rules; **this proves the contract**: status codes, the
`code` field clients branch on, and above all that authorization is enforced by the server and
not merely by the UI.

- [ ] **Step 1: Write the suite.**

`describe('authentication')` — unauthenticated list → 401; garbage bearer → 401.

`describe('authorization — the server, not the UI, decides')` — a table-driven `it.each` over
**all seven routes** (list, get, create, update, delete, restore, reset) asserting **403 for a
`sales` token**, plus list/create asserting 403 for a `mgmt` token, plus one allow case for admin.

`describe('list contract')`:
| Test | Asserts |
| --- | --- |
| returns items, nextCursor, total | shape |
| `status=inactive` really filters | every row inactive |
| unknown `status` value → 400 | not silently ignored |
| `limit=1000` → 400 | max enforced |
| never serialises a password hash | body fails `/passwordHash\|\$argon2/` |

`describe('create contract')`: 201 + `mustChangePassword: true` and no `password` key;
malformed email → 400 `ValidationError`; weak password → 400 `WEAK_PASSWORD`; taken email →
409 `DUPLICATE_IDENTITY`; unknown role → **400 `INVALID_REFERENCE`, not 500**.

`describe('invariants over HTTP')`: self-deactivate → 409 `SELF_MUTATION_FORBIDDEN`;
self-delete → 409; self-managing → 400 `INVALID_MANAGER`; cross-tenant get → 404
`USER_NOT_FOUND`; cross-tenant update → 404.

`describe('delete and restore')`: delete → 204 and gone from the default list, restore → back;
**the email is reusable while the user is deleted** (create a second user on the same email → 201).

`describe('reset-password')`: 200 `{ mustChangePassword: true }` with the password not echoed;
and the target can sign in but is then **403 `PASSWORD_CHANGE_REQUIRED`** on `/customers` —
proving Task 7's guard end to end.

- [ ] **Step 2:** `pnpm --filter api test:e2e users` → fix whatever it reports. **No new production code is planned here; if a test fails the defect is real — correct the code, never weaken the test.**
- [ ] **Step 3:** `pnpm --filter api test && pnpm --filter api test:e2e` → PASS
- [ ] **Step 4:** `git commit -m "test(api): HTTP contract and authorization suite for /users"`

---

## Phase 3 — Roles API

### Task 15: Roles contracts and `GET /permissions`

**Files:**
- Create: `packages/shared/src/role.ts`; modify `index.ts`
- Create: `apps/api/src/roles/{roles.service.ts,roles.controller.ts,roles.module.ts}`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/roles/roles.service.spec.ts`

**Interfaces produced:**
```ts
export interface RoleRow {
  id: string; name: string; isSystem: boolean;
  permissionKeys: string[]; userCount: number;
  createdAt: string; updatedAt: string;
}
export interface PermissionGroup { module: string; permissions: { key: string; label: string }[] }
export const RoleCreateSchema = z.object({
  name: z.string().min(1).max(60),
  permissionKeys: z.array(z.string()).min(1),
});
export const RoleUpdateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  permissionKeys: z.array(z.string()).optional(),
}).refine(o => Object.keys(o).length > 0, { message: "At least one field must be provided" });
class RolesService {
  list(user: RequestUser): Promise<RoleRow[]>;
  permissions(): PermissionGroup[];
}
```

Routes: `GET /roles` and `GET /permissions`.

**Authorization nuance:** `GET /roles` requires **`user.manage` OR `role.manage`** — the user
editor needs the dropdown, and an admin who can create users but not edit roles must still see
role names. Implement with a new `@RequireAnyPermission(...)` decorator + guard branch;
everything else in `/roles` requires `role.manage`.

`PERMISSION_LABELS` (a human label per key) lives beside `PERMISSIONS` in
`packages/shared/src/rbac.ts` so the matrix header is not invented in the UI.

**No N+1:** `list()` uses a single `findMany` with
`include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } }`.

- [ ] **Step 1: Write the failing tests** in `roles.service.spec.ts`:

| Test | Asserts |
| --- | --- |
| lists all tenant roles including one with zero users | `role_viewer_acme` present, `userCount === 0` — **the W2 fix** |
| returns real permission keys per role | admin role contains `user.manage` and `role.manage`; sales does not |
| returns an accurate `userCount` | sales role count matches a direct `user.count` |
| isolates tenants | Globex roles invisible to an Acme caller |
| flags system roles | `admin`/`mgmt`/`sales` → `isSystem: true`; `viewer` → `false` |
| `permissions()` returns all 13 keys grouped by module | `flatMap(g => g.permissions).length === PERMISSION_KEYS.length` |
| every permission has a human label | no key falls back to its own raw string |
| **issues one query per list call** | count queries via a Prisma `$on('query')` probe, assert ≤ 2 — proves no N+1 |

- [ ] **Step 2:** run → FAIL (module does not exist)
- [ ] **Step 3:** implement service, controller, module; register in `app.module.ts`
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(roles): list roles with live permission grants and user counts"`

---

### Task 16: Role create, update, delete with I6-I8

**Files:** modify `roles.service.ts`, `roles.controller.ts`; test `roles.service.spec.ts`

**Interfaces produced:**
```ts
class RolesService {
  create(user: RequestUser, body: RoleCreate): Promise<RoleRow>;
  update(user: RequestUser, id: string, patch: RoleUpdate): Promise<RoleRow>;
  remove(user: RequestUser, id: string): Promise<void>;
}
```
Routes: `POST /roles`, `PATCH /roles/:id`, `DELETE /roles/:id` (204) — all `role.manage`.

**Invariants:**
- **I6 `SYSTEM_ROLE_PROTECTED`** — a system role may not be renamed or deleted. Its
  *permissions* remain editable: a tenant may legitimately want a narrower `mgmt`.
- **I7 `ROLE_IN_USE`** — a role with any user (including soft-deleted ones, whose `roleId` still
  points at it) may not be deleted. Roles are hard-deleted precisely because a soft-deleted role
  would leave `User.roleId` dangling and RBAC would silently resolve it to an empty permission
  set — stripping access with no visible cause.
- **I8 `LAST_ADMIN_ROLE_PROTECTED`** — `user.manage` or `role.manage` may not be removed from
  the last role that grants it **and has at least one live user**. Same `FOR UPDATE` transaction
  discipline as Task 11.
- Unknown permission keys → 400 `INVALID_REFERENCE` (validated against `PERMISSION_KEYS`,
  never trusted from the request).
- Duplicate role name in the tenant → 409 `DUPLICATE_IDENTITY` (`@@unique([tenantId, name])`).
- Permission replacement is `deleteMany` + `createMany` inside one transaction, so a partial
  grant set can never be observed.
- Changing a role's permissions **revokes every live session of every user holding that role** —
  the access token's permissions are resolved per request, but `roleId` is baked in and a
  demotion must take effect immediately. Reason: `role_permissions_changed`.
- Every mutation writes an `AuditLog` row with `entity: 'Role'`.

- [ ] **Step 1: Write the failing tests** in `describe('role mutations (I6-I8)')`:

| Test | Asserts |
| --- | --- |
| creates a custom role with the requested grants | `isSystem === false`, keys match |
| rejects an unknown permission key | 400 `INVALID_REFERENCE` |
| rejects a duplicate role name | 409 `DUPLICATE_IDENTITY` |
| renames a custom role | resolves |
| **refuses to rename a system role** | 409 `SYSTEM_ROLE_PROTECTED` |
| **allows editing a system role's permissions** | `mgmt` loses `report.view` → resolves |
| replaces the permission set wholesale | old keys gone, new keys present |
| deletes an unused custom role | 204, absent from list |
| **refuses to delete a role with users** | 409 `ROLE_IN_USE` |
| **refuses to delete a role whose only users are soft-deleted** | 409 `ROLE_IN_USE` |
| **refuses to delete a system role** | 409 `SYSTEM_ROLE_PROTECTED` |
| **refuses to strip `user.manage` from the last admin role** | 409 `LAST_ADMIN_ROLE_PROTECTED` |
| allows stripping it when another populated role still grants it | resolves |
| revokes sessions of users in a role whose permissions changed | `live(user_sales1_acme) === 0` |
| writes an audit row with before/after permission sets | `entity: 'Role'`, both sides present |
| cross-tenant role id → 404 `ROLE_NOT_FOUND` | |

- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** implement
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(roles): custom role CRUD with system-role and last-admin-role protection"`

---

### Task 17: Roles HTTP e2e suite

**Files:** Create `apps/api/test/roles.e2e-spec.ts`

Same bootstrap and `as(token)` helper as Task 14.

- [ ] **Step 1: Write the suite.**

| Group | Cases |
| --- | --- |
| authentication | unauthenticated → 401 on every route |
| authorization | `sales` → 403 on all five routes; **`mgmt` → 403**; admin → 200 |
| **permission separation** | a purpose-built role with `user.manage` but **not** `role.manage` → **200 on `GET /roles`** but **403 on `POST/PATCH/DELETE /roles`**. This is the one behaviour a single-permission check would get wrong |
| `GET /permissions` | 200, 13 keys, grouped, requires only authentication |
| create contract | 201; empty `permissionKeys` → 400; name > 60 chars → 400; duplicate name → 409 `DUPLICATE_IDENTITY` |
| invariants over HTTP | rename system role → 409 `SYSTEM_ROLE_PROTECTED`; delete role in use → 409 `ROLE_IN_USE`; strip last admin permission → 409 `LAST_ADMIN_ROLE_PROTECTED` |
| isolation | Globex role id → 404 `ROLE_NOT_FOUND` on get/patch/delete |

- [ ] **Step 2:** `pnpm --filter api test:e2e roles` → PASS
- [ ] **Step 3:** `git commit -m "test(api): HTTP contract and authorization suite for /roles"`

---

## Phase 4 — Teams API

### Task 18: Teams CRUD

**Files:**
- Create: `packages/shared/src/team.ts`; modify `index.ts`
- Create: `apps/api/src/teams/{teams.service.ts,teams.controller.ts,teams.module.ts}`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/teams/teams.service.spec.ts`

**Interfaces produced:**
```ts
export interface TeamRow {
  id: string; name: string;
  managerId: string; managerName: string;
  memberCount: number; createdAt: string; updatedAt: string;
}
export const TeamCreateSchema = z.object({
  name: z.string().min(1).max(80), managerId: z.string().min(1),
});
export const TeamUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(), managerId: z.string().min(1).optional(),
}).refine(o => Object.keys(o).length > 0, { message: "At least one field must be provided" });
export const TeamMembersSchema = z.object({ userIds: z.array(z.string()).min(1).max(200) });
class TeamsService {
  list(user: RequestUser): Promise<TeamRow[]>;
  create(user: RequestUser, body: TeamCreate): Promise<TeamRow>;
  update(user: RequestUser, id: string, patch: TeamUpdate): Promise<TeamRow>;
  remove(user: RequestUser, id: string): Promise<void>;
}
```
Routes: `GET/POST /teams`, `PATCH/DELETE /teams/:id` — all `user.manage`.

**I10 `INVALID_MANAGER`** — a team's manager must be a live, active user in the same tenant.
`Team.managerId` is a required FK, so a bad value would otherwise be a P2003 500.

**Delete is a soft-delete** (`Team.deletedAt` already exists) and **detaches every member in the
same transaction** — otherwise `User.teamId` would point at an invisible team and the Users
table would render a team name for a team that no longer appears in the Teams tab.

`memberCount` via `_count: { select: { members: true } }` filtered to live members — one query,
no N+1. Every mutation audits with `entity: 'Team'`.

- [ ] **Step 1: Write the failing tests** in `teams.service.spec.ts`:

| Test | Asserts |
| --- | --- |
| lists both seeded teams with manager name and member count | `team_acme` count matches a direct `user.count` |
| isolates tenants | Globex teams invisible |
| creates a team | resolves with `managerName` populated |
| **rejects a manager from another tenant** | 400 `INVALID_MANAGER` |
| **rejects a soft-deleted manager** | 400 `INVALID_MANAGER` |
| **rejects an inactive manager** | 400 `INVALID_MANAGER` |
| renames a team | resolves |
| changes the manager | `managerName` updates |
| **soft-deletes and detaches every member** | team absent from list; each ex-member's `teamId === null` |
| a detached member is still listed as a user | proves detach ≠ delete |
| cross-tenant team id → 404 `TEAM_NOT_FOUND` | |
| writes audit rows for create/update/delete | `entity: 'Team'` |

- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** implement
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(teams): team CRUD with manager validation and safe delete"`

---

### Task 19: Team membership

**Files:** modify `teams.service.ts`, `teams.controller.ts`; test `teams.service.spec.ts`

**Interfaces produced:**
```ts
class TeamsService {
  addMembers(user: RequestUser, teamId: string, body: TeamMembers): Promise<{ added: number }>;
  removeMember(user: RequestUser, teamId: string, userId: string): Promise<void>;
  members(user: RequestUser, teamId: string): Promise<UserRow[]>;
}
```
Routes: `GET /teams/:id/members`, `POST /teams/:id/members`, `DELETE /teams/:id/members/:userId`.

Bulk add is **idempotent** — re-adding an existing member is a no-op that still returns 200, so
a double-clicked button does not error. Capped at 200 ids per call (`TeamMembersSchema`) to
bound the transaction. Unknown or cross-tenant user ids → 400 `INVALID_REFERENCE`, and the
**whole batch is rejected** rather than partially applied.

- [ ] **Step 1: Write the failing tests** in `describe('team membership')`:

| Test | Asserts |
| --- | --- |
| adds members in bulk | `{ added: 2 }`, both `teamId` updated |
| moving a member between teams updates the count on both | source − 1, destination + 1 |
| re-adding an existing member is idempotent | no error, count unchanged |
| **rejects the whole batch if any id is unknown** | 400 `INVALID_REFERENCE`, **and no member was added** |
| rejects a cross-tenant user id | 400 `INVALID_REFERENCE` |
| removes one member | `teamId === null`, user still exists |
| removing a non-member is a no-op, not an error | resolves |
| lists members without password hashes | no `passwordHash`; no `/\$argon2/` |
| rejects a batch of 201 ids | 400 validation |

- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** implement
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(teams): bulk member assignment and removal"`

---

### Task 20: Teams HTTP e2e suite

**Files:** Create `apps/api/test/teams.e2e-spec.ts`

- [ ] **Step 1: Write the suite** — same shape as Tasks 14 and 17:
  401 unauthenticated on every route; **403 for `sales` and `mgmt` on all seven routes**;
  200/201/204 for admin; 400 validation (empty `userIds`, 201 ids, missing `managerId`);
  400 `INVALID_MANAGER`; 404 `TEAM_NOT_FOUND` cross-tenant; delete → 204 and members detached
  as observed through `GET /users`.
- [ ] **Step 2:** `pnpm --filter api test:e2e teams` → PASS
- [ ] **Step 3:** Run the **whole** API surface: `pnpm --filter api test && pnpm --filter api test:e2e` → PASS
- [ ] **Step 4:** `git commit -m "test(api): HTTP contract and authorization suite for /teams"`

---

## Phase 5 — Web

### Task 21: Auth store exposes the real permission set

**Files:**
- Modify: `apps/web/src/features/projections/types.ts` (`AuthUser`), `apps/web/src/store/auth.ts`
- Test: `apps/web/tests/store/auth.permissions.test.ts`

**Interfaces produced:**
```ts
// types.ts — AuthUser gains:
permissions: string[];
mustChangePassword: boolean;

// store/auth.ts
export const usePermissions = (): ReadonlySet<string> => …;
export const useHasPermission = (key: string): boolean => …;
export const useMustChangePassword = (): boolean => …;
```

`usePermissions` memoises the `Set` off `user.permissions` so it is referentially stable across
renders — a fresh `Set` every render would defeat every downstream `useMemo`.

**This is presentation only.** Every one of these permissions is enforced server-side and proved
by a deny test (Tasks 14, 17, 20). The UI uses them to avoid offering buttons that would 403 —
AGENTS.md §7: never rely on frontend restrictions for security.

- [ ] **Step 1: Write the failing tests:**

| Test | Asserts |
| --- | --- |
| exposes permissions from the login response | set contains `user.manage` |
| an empty set before sign-in | `usePermissions().size === 0`, no crash |
| `useHasPermission` is false for a key the role lacks | `role.manage` false for a sales session |
| the set is referentially stable across re-renders | same object identity when `user` is unchanged |
| survives a `bootstrap()` refresh | permissions repopulate from `/auth/me` |

- [ ] **Step 2:** `pnpm --filter web test auth.permissions` → FAIL
- [ ] **Step 3:** implement
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(web): expose the session permission set from the auth store"`

---

### Task 22: Wire types and query hooks

**Files:**
- Modify: `apps/web/src/features/users/types.ts`, `queries.ts`
- Create: `apps/web/src/features/users/roles.queries.ts`, `teams.queries.ts`
- Test: `apps/web/tests/features/users/queries.test.ts` (extend), `roles.queries.test.ts`, `teams.queries.test.ts`

**Interfaces produced:**
```ts
// types.ts mirrors the shared contracts exactly (kept local so Vite need not
// consume the CJS shared dist — the API is the source of truth).
export interface UserParams {
  search?: string; roleId?: string; teamId?: string;
  status?: "all" | "active" | "inactive";
  sort?: "name"|"email"|"username"|"createdAt"|"lastLoginAt";
  dir?: "asc" | "desc"; includeDeleted?: boolean;
}
export const userKeys = { all: ["users"] as const, list: (p: UserParams) => ["users", p] as const };
export const roleKeys = { all: ["roles"] as const, list: () => ["roles"] as const,
                          permissions: () => ["permissions"] as const };
export const teamKeys = { all: ["teams"] as const, list: () => ["teams"] as const,
                          members: (id: string) => ["teams", id, "members"] as const };

export function useUsers(p?: UserParams, o?: { enabled?: boolean }): UseInfiniteQueryResult<…>;
export function useUserTotal(data?: { pages: UserListResponse[] }): number;
export function useCreateUser(); useUpdateUser(); useDeleteUser();
export function useRestoreUser(); useResetPassword();
export function useRoles(); usePermissionCatalog();
export function useCreateRole(); useUpdateRole(); useDeleteRole();
export function useTeams(); useTeamMembers(teamId); useCreateTeam(); useUpdateTeam();
export function useDeleteTeam(); useAddTeamMembers(); useRemoveTeamMember();
```

**Cross-invalidation matters.** A role change alters `userCount`; a team delete detaches members.
So role mutations invalidate `["roles"]` **and** `["users"]`; team mutations invalidate
`["teams"]` **and** `["users"]`; user mutations invalidate `["users"]`, `["roles"]` (counts),
and `["teams"]` (counts). Without this the tabs disagree with each other.

`useUserTotal` reads `pages[0].total` — the server's count, not `items.length` (W5).

- [ ] **Step 1: Write the failing tests** (fetch stubbed, per the existing `queries.test.ts` pattern):

| Test | Asserts |
| --- | --- |
| serialises every list param into the query string | `status`, `sort`, `dir`, `teamId`, `includeDeleted` all present |
| omits undefined params rather than sending `"undefined"` | URL has no `roleId=` when unset |
| `includeDeleted` is sent as the string `"true"`/`"false"` | matches the server's `BoolFlag` enum |
| `useUserTotal` reads the server total, not the loaded length | 3 loaded rows, `total: 47` → 47 |
| the infinite query follows `nextCursor` | second page requested with `cursor=` |
| a role mutation invalidates users **and** roles | both keys invalidated |
| a team mutation invalidates teams **and** users | both keys invalidated |
| a user mutation invalidates users, roles, and teams | all three |
| `useResetPassword` posts to `/users/:id/reset-password` | correct URL and method |
| `useRestoreUser` posts to `/users/:id/restore` | correct URL and method |
| mutation errors surface as `ApiError` with the `code` | `code === 'LAST_ADMIN_PROTECTED'` readable |

`ApiError` must carry the `code`: extend it in `apps/web/src/lib/api.ts` to read `body.code`
alongside `message` and `details`. Add a test for that in `apps/web/tests/lib/api.refresh.test.ts`.

- [ ] **Step 2:** `pnpm --filter web test queries` → FAIL
- [ ] **Step 3:** implement the three query modules and the `ApiError.code` field
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(web): query hooks for users, roles and teams with cross-invalidation"`

---

### Task 23: `UsersPage` shell — three tabs synced to `?tab=`

**Files:**
- Rewrite: `apps/web/src/features/users/UsersPage.tsx` (280 → ~90 lines)
- Create: `apps/web/src/features/users/tabs/{UsersTab,RolesTab,TeamsTab}.tsx` (stubs this task)
- Test: `apps/web/tests/features/users/UsersPage.tabs.test.tsx`

**Interfaces produced:**
```ts
export type UsersPageTab = "users" | "roles" | "teams";
export default function UsersPage(): JSX.Element;
```

The shell owns **only** tab state; each tab owns its own data. Tab state lives in the URL
(`useSearchParams`) so refresh, browser back, and a shared deep link all work — the current page
loses all state on reload.

The `Roles` tab is hidden entirely when the caller lacks **both** `role.manage` and
`user.manage`; the `Teams` tab requires `user.manage`. An unknown or unauthorised `?tab=` value
falls back to `users` and rewrites the URL with `replace: true` so it does not poison history.

- [ ] **Step 1: Write the failing tests:**

| Test | Asserts |
| --- | --- |
| renders the Users tab by default | users table visible |
| `?tab=roles` deep-links straight to Roles | roles panel visible on first render |
| clicking a tab updates the URL | search param becomes `tab=teams` |
| browser Back returns to the previous tab | history entry per switch |
| an unknown `?tab=` value falls back to Users | and the URL is rewritten |
| hides the Roles tab without `role.manage` or `user.manage` | tab not in the DOM |
| a `?tab=roles` deep link without permission falls back to Users | no permission-leaking flash |
| the tab strip is a real `role="tablist"` with arrow-key navigation | ArrowRight moves focus and selection |

- [ ] **Step 2:** `pnpm --filter web test UsersPage.tabs` → FAIL
- [ ] **Step 3:** implement the shell using the existing `Tabs` component from `components/ui.tsx`, extending it with `role="tablist"`/`role="tab"`/`aria-selected` and arrow-key handling
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(web): split the users page into url-synced tabs"`

---

### Task 24: Users tab — table, filters, sorting, real total

**Files:**
- Implement: `apps/web/src/features/users/tabs/UsersTab.tsx`
- Test: `apps/web/tests/features/users/UsersTab.filters.test.tsx`

Columns: Name · Username · Email · Role · Team · Manager · Last login · Status · Actions (W6).
Filters: debounced search (300 ms, server-side), role, team, status, "Show deleted".
Sorting by clicking a header, reflected in the query and in `aria-sort`.

**`useMockOwnerId` is removed from this file entirely** — the current user comes from
`useAuth((s) => s.user?.id)`, so `(you)` renders correctly and the self-guard engages (W1).
Action visibility comes from `useHasPermission("user.manage")`, not `role === "admin"` (W7).

The header count reads `useUserTotal(q.data)` — the server's number (W5).

- [ ] **Step 1: Write the failing tests:**

| Test | Asserts |
| --- | --- |
| renders every column including manager, team, and last login | headers present |
| shows `(you)` against the signed-in user | **matched on the real session id, not a mock** |
| shows the server total, not the loaded row count | 3 rows loaded, `total: 47` → header says 47 |
| debounces search into one request | type 5 chars fast → exactly one refetch after 300 ms |
| the role filter offers roles with **no users** | `viewer` selectable — **the W2 fix** |
| the team filter sends `teamId` | request carries it |
| the status filter sends `status=inactive` | not `active=false` |
| clicking a header sorts and sets `aria-sort` | `sort=email&dir=asc`, then `desc` on second click |
| "Show deleted" sends `includeDeleted=true` and shows a Deleted badge | |
| Load more requests the next cursor | |
| renders a loading skeleton | |
| renders a retryable error state | |
| renders an empty state naming the active filter | not a bare "no records" |
| **renders a permission-denied panel, not an empty table** | without `user.manage` — an empty table would read as "there are no users" |
| the table has a `<caption>` | a11y |

- [ ] **Step 2:** `pnpm --filter web test UsersTab.filters` → FAIL
- [ ] **Step 3:** implement
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(web): users tab with server-side filters, sorting and real totals"`

---

### Task 25: Row actions and confirmation modals

**Files:**
- Create: `apps/web/src/features/users/modals/ConfirmActionModal.tsx`
- Modify: `apps/web/src/features/users/tabs/UsersTab.tsx`
- Test: `apps/web/tests/features/users/UsersTab.actions.test.tsx`

**Interfaces produced:**
```ts
export function ConfirmActionModal(props: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; body: React.ReactNode;
  confirmLabel: string; destructive?: boolean; pending?: boolean; error?: unknown;
}): JSX.Element;
```

Every destructive action names the user and states the **consequence**, not just the verb:
- Deactivate → "Ends all their sessions immediately."
- Delete → "Frees their email and username for reuse. You can restore them later."
- Reset password → its own modal (Task 27).

Actions absent for your own row where the server would refuse (deactivate, delete, reset), with
a tooltip explaining why rather than an unexplained gap (W4, W1).

**Server errors are rendered by `code`**, so `LAST_ADMIN_PROTECTED` shows the actionable
sentence — "Grant another user the Manage users permission first" — rather than a raw 409.

- [ ] **Step 1: Write the failing tests:**

| Test | Asserts |
| --- | --- |
| Deactivate opens a confirm naming the user and the consequence | no request fired yet — **W4** |
| confirming fires the PATCH | `{ active: false }` |
| cancelling fires nothing | |
| Delete opens its own confirm and fires DELETE | |
| Delete confirm mentions that the email is freed | |
| a deleted row offers Restore, which fires POST `/restore` | |
| **your own row offers no Deactivate, Delete or Reset** | and Edit remains |
| your own row explains why those are absent | tooltip present |
| a `LAST_ADMIN_PROTECTED` 409 renders the actionable message | matched by `code` |
| a `SELF_MUTATION_FORBIDDEN` 409 renders its message | |
| the confirm button is disabled while pending | double-submit prevented |
| the row shows a pending indicator during its own mutation | and other rows do not |
| the error is announced via `role="alert"` | a11y |

- [ ] **Step 2:** `pnpm --filter web test UsersTab.actions` → FAIL
- [ ] **Step 3:** implement
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(web): confirmed destructive user actions with coded error handling"`

---

### Task 26: `PasswordField` and `UserFormModal`

**Files:**
- Create: `apps/web/src/features/users/PasswordField.tsx`, `modals/UserFormModal.tsx`
- Delete: `apps/web/src/features/users/EditUserModal.tsx`
- Test: `apps/web/tests/features/users/PasswordField.test.tsx`, `UserFormModal.test.tsx`

**Interfaces produced:**
```ts
export function PasswordField(props: {
  value: string; onChange: (v: string) => void;
  identity: { name?: string; email?: string; username?: string };
  required?: boolean; label?: string; helpText?: string;
}): JSX.Element;

export function UserFormModal(props: {
  open: boolean; onClose: () => void; user: UserRow | null;
}): JSX.Element;
```

`PasswordField` imports `validatePassword` and `passwordStrength` **from the shared package** —
the same function the API runs, so the client cannot tell the user a password is fine that the
server will then reject. It offers reveal and a cryptographically-random generate
(`crypto.getRandomValues`, never `Math.random`).

`UserFormModal` replaces `EditUserModal`. Role, manager, and team dropdowns are fed from
`useRoles()`, `useUsers()` and `useTeams()` — **not** from the loaded rows (W2). It is keyed by
`user?.id ?? "new"` at the call site so switching directly from editing user A to user B
remounts with fresh state instead of showing A's values.

- [ ] **Step 1: Write the failing tests.**

`PasswordField.test.tsx`:

| Test | Asserts |
| --- | --- |
| shows a strength meter that rises with quality | |
| blocks a password shorter than 12 with the shared message | same text the API returns |
| blocks a password containing the username being typed | live, before submit |
| the reveal toggle switches `type` between password and text | |
| generate produces a value that passes `validatePassword` | run 20 times, all pass |
| generate uses `crypto.getRandomValues` | spy asserts it, and that `Math.random` is untouched |
| the input is labelled and errors are `aria-describedby` | a11y |

`UserFormModal.test.tsx`:

| Test | Asserts |
| --- | --- |
| create mode requires name, username, email, role, password | submit disabled |
| **the role dropdown lists roles with no users** | `viewer` present — W2 |
| the manager dropdown excludes the user being edited | no self-management offered |
| the team dropdown lists all teams | |
| edit mode pre-fills and leaves password blank | placeholder says blank keeps the current one |
| edit mode omits `password` when left blank | patch has no `password` key |
| switching directly from user A to user B shows B's values | the remount-key behaviour |
| a 409 `DUPLICATE_IDENTITY` renders on the email field | not a generic banner |
| a 400 `WEAK_PASSWORD` renders on the password field | |
| a 400 `INVALID_MANAGER` renders on the manager field | |
| the submit button is disabled while pending | |
| Escape closes and focus returns to the trigger | a11y |

- [ ] **Step 2:** `pnpm --filter web test PasswordField UserFormModal` → FAIL
- [ ] **Step 3:** implement both; delete `EditUserModal.tsx` and its import
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(web): shared-policy password field and rebuilt user form modal"`

---

### Task 27: `ResetPasswordModal`

**Files:** Create `apps/web/src/features/users/modals/ResetPasswordModal.tsx`; test `ResetPasswordModal.test.tsx`

Separate from the edit form because it is a different, more dangerous act with a different
consequence to explain: **"This signs them out of every device, and they will be asked to choose
a new password the next time they sign in."**

- [ ] **Step 1: Write the failing tests:**

| Test | Asserts |
| --- | --- |
| states both consequences before confirming | sessions ended + forced change |
| reuses `PasswordField` and its validation | weak password blocks submit |
| posts to `/users/:id/reset-password` on confirm | |
| shows the generated password once, with a copy control | **and never re-displays it after close** |
| renders a `SELF_MUTATION_FORBIDDEN` 409 | when somehow invoked on yourself |
| disables confirm while pending | |

- [ ] **Step 2:** run → FAIL
- [ ] **Step 3:** implement
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(web): admin password reset modal"`

---

### Task 28: Roles tab — the live permission matrix

**Files:**
- Implement: `apps/web/src/features/users/tabs/RolesTab.tsx`
- Create: `apps/web/src/features/users/modals/RoleFormModal.tsx`
- Test: `apps/web/tests/features/users/RolesTab.test.tsx`

**This deletes the hardcoded "Role permissions reference" table (W3)** — 60 lines of static
markup with no relationship to actual `RolePermission` rows, free to lie at any time.

Replaced by: roles down the side, the 13 permission keys grouped by module across the top,
checkboxes reflecting real grants from `GET /roles` + `GET /permissions`. Editable with
`role.manage`, read-only otherwise. System roles show a lock on the name. The
`LAST_ADMIN_ROLE_PROTECTED` checkbox is disabled with an explanatory tooltip **and** enforced
server-side.

- [ ] **Step 1: Write the failing tests:**

| Test | Asserts |
| --- | --- |
| renders one row per role, including the empty `viewer` role | |
| checkboxes reflect **real** grants from the API | admin row has `user.manage` checked, sales does not |
| **no hardcoded permission text remains** | grep the rendered output for the old copy — absent |
| shows an accurate user count per role | |
| permission columns are grouped by module | |
| toggling a checkbox PATCHes the role with the full new key set | wholesale replacement |
| the matrix is read-only without `role.manage` | inputs disabled, no PATCH on click |
| system roles show a lock and a disabled name field | |
| a system role's permissions are still editable | |
| the last admin role's `user.manage` checkbox is disabled with a tooltip | |
| a `LAST_ADMIN_ROLE_PROTECTED` 409 renders its actionable message | |
| Add role opens the form; create fires POST | |
| Delete on a role in use renders `ROLE_IN_USE` | |
| Delete on a system role is not offered | |
| loading, error, and permission-denied states render | |
| the matrix table has a `<caption>` and header scopes | a11y |

- [ ] **Step 2:** `pnpm --filter web test RolesTab` → FAIL
- [ ] **Step 3:** implement; **delete** the hardcoded card from `UsersPage.tsx`
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(web): replace the hardcoded permission table with a live editable matrix"`

---

### Task 29: Teams tab

**Files:**
- Implement: `apps/web/src/features/users/tabs/TeamsTab.tsx`
- Create: `apps/web/src/features/users/modals/TeamFormModal.tsx`
- Test: `apps/web/tests/features/users/TeamsTab.test.tsx`

Team list with name, manager, member count. Create / rename / change manager / delete. Expanding
a row lists members with a remove control and an "Add members" picker filtered to users not
already in the team.

- [ ] **Step 1: Write the failing tests:**

| Test | Asserts |
| --- | --- |
| lists teams with manager and member count | |
| expanding a row loads and lists its members | |
| Add members opens a picker excluding current members | |
| adding posts the selected ids and updates both counts | |
| removing a member fires DELETE and updates the count | |
| Delete opens a confirm stating **members will be unassigned** | consequence, not just the verb |
| confirming delete fires DELETE and drops the team | |
| the manager dropdown lists active users only | |
| a 400 `INVALID_MANAGER` renders on the manager field | |
| loading, error, empty, and permission-denied states render | |
| the empty state offers "Create your first team" | actionable, not a dead end |

- [ ] **Step 2:** `pnpm --filter web test TeamsTab` → FAIL
- [ ] **Step 3:** implement
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(web): teams tab with membership management"`

---

### Task 30: Forced password change screen

**Files:**
- Create: `apps/web/src/features/auth/ChangePasswordPage.tsx`
- Modify: `apps/web/src/App.tsx` (route + `ProtectedRoute` redirect)
- Test: `apps/web/tests/features/auth/ChangePasswordPage.test.tsx`

Without this the whole `mustChangePassword` mechanism is a trap: a user whose password an admin
reset would be signed in and 403'd from every page with no way out. `ProtectedRoute` redirects
to `/change-password` whenever `useMustChangePassword()` is true, and that route is exempt from
the redirect so it cannot loop.

- [ ] **Step 1: Write the failing tests:**

| Test | Asserts |
| --- | --- |
| a flagged session is redirected from any page to `/change-password` | |
| the change-password route itself does not redirect | no loop |
| an unflagged session is never redirected | |
| submitting posts `{ currentPassword, newPassword }` | |
| a 401 renders "current password is incorrect" | |
| a 400 `WEAK_PASSWORD` renders on the new-password field | |
| success clears the flag and lands on the role's home route | |
| the page explains that other sessions will be signed out | |
| Sign out remains available — never a locked room | |

- [ ] **Step 2:** `pnpm --filter web test ChangePasswordPage` → FAIL
- [ ] **Step 3:** implement
- [ ] **Step 4:** rerun → PASS
- [ ] **Step 5:** `git commit -m "feat(web): forced password change screen"`

---

## Phase 6 — Verification, measurement, docs

### Task 31: Measure the queries (§11)

**Files:** Create `apps/api/src/users/users.performance.spec.ts`; append results to this plan

Seeds 10,000 users into `tenant_acme`, then records `EXPLAIN (ANALYZE, BUFFERS)` for the default
page, a search, and the count.

- [ ] **Step 1: Write the measurement spec**

| Assertion | Threshold |
| --- | --- |
| default page (limit 50) uses `User_tenantId_deletedAt_name_idx` | plan contains the index name, **no Seq Scan** |
| default page execution time | < 20 ms |
| `total` count time | < 30 ms |
| search (`ILIKE '%term%'`) time | < 50 ms |

- [ ] **Step 2:** run it and **write the measured numbers into this file** under "Measured performance"
- [ ] **Step 3:** if search exceeds 50 ms, add `pg_trgm` + a GIN index in a follow-up migration and re-measure. If it does not, record that the index was **deliberately not added** and why — §6 is satisfied by the number, not by the index
- [ ] **Step 4:** `git commit -m "test(api): record measured query plans for the users list"`

---

### Task 32: Full verification and documentation

- [ ] **Step 1: Run every gate and paste the real output**

```bash
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter web test
pnpm check-types
pnpm lint
```

All five must be green. **Paste actual output** — a summary is not evidence
(superpowers:verification-before-completion).

- [ ] **Step 2: Confirm the "no fake completion" checklist**

```bash
grep -rn "useMockOwnerId" apps/web/src/features/users/   # must be empty
grep -rn "Role permissions reference" apps/web/src/       # must be empty
grep -rn "TODO\|FIXME" apps/api/src/users apps/api/src/roles apps/api/src/teams apps/web/src/features/users
```

- [ ] **Step 3: Manual verification in the running app**

Start the dev server and drive it: sign in as admin, create a user with the `viewer` role
(proving W2), try to deactivate yourself (proving I1), reset another user's password, sign in as
them and confirm the forced-change screen, edit the permission matrix, create a team and move a
member. Screenshot each.

- [ ] **Step 4: Update the docs**

| File | Change |
| --- | --- |
| `CHANGELOG.md` | The F12 entry |
| `SECURITY.md` | Session revocation triggers; the forced-password-change model; the password policy |
| `DEPLOYMENT.md` | The F12 index migration procedure (`CONCURRENTLY` path) and the down-migration guard |
| `docs/FEATURE-ROADMAP.md` | F12 → Delivered, with the outcome table and any deferrals |
| `ADMIN-CAPABILITIES.md` | What an administrator can now do without touching the database |

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: record F12 delivery, security model and migration procedure"
```

---

## Measured performance

> Filled in by Task 31. Do not mark this plan complete while this section is empty.

| Query | Rows | Index used | Time |
| --- | --- | --- | --- |
| | | | |

---

## Definition of Done

- [ ] Every invariant I1–I10 has a passing **deny** test at both the service and HTTP layer
- [ ] `useMockOwnerId` no longer appears anywhere in `features/users/`
- [ ] The hardcoded permissions table no longer exists
- [ ] `?status=inactive` returns inactive users (the A1 regression is fixed and covered)
- [ ] A soft-deleted user's email can be reused, and restore fails cleanly when it cannot
- [ ] Every user, role, and team mutation writes an audit row containing **no** credential data
- [ ] Deactivate, delete, password reset, and role change all revoke sessions immediately
- [ ] All five verification gates green with pasted output
- [ ] Measured performance numbers recorded above
- [ ] Docs updated
