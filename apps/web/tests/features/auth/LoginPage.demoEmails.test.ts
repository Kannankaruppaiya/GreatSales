import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DEMO_EMAIL_BY_ROLE, DEMO_PASSWORD_BY_ROLE } from "@/features/auth/LoginPage";
import { env } from "@/lib/config";

/**
 * A prefilled demo credential that doesn't belong to any seeded user isn't just
 * wrong — it silently breaks the "click Sign In" happy path for that role. Unit
 * tests that mock the API can't catch this (they'll happily "log in" with a
 * fictitious email), so this test reads the seed's own inputs instead:
 * `packages/db/prisma/poc-v6-data.json` (the POC v6 user list that `seed.ts`
 * inserts verbatim) plus two anchors in `seed.ts` itself — the tenant id and the
 * email format it derives from each POC username.
 */
describe("demo login prefill matches an actually-seeded user", () => {
  const dbDir = path.resolve(fileURLToPath(import.meta.url), "../../../../../../packages/db/prisma");
  const seedSource = readFileSync(path.join(dbDir, "seed.ts"), "utf8");
  const pocUsers = (
    JSON.parse(readFileSync(path.join(dbDir, "poc-v6-data.json"), "utf8")) as {
      users: { u: string; p: string; role: string; active: boolean }[];
    }
  ).users;

  // seed.ts builds each login as `<poc username>@<domain>` — pull the domain out
  // of the source so renaming it fails here instead of at the login form.
  const domainMatch = seedSource.match(/email:\s*u\.u \+ "@([a-z0-9.-]+)"/);
  const tenantMatch = seedSource.match(/const TENANT_ID = "([^"]+)"/);

  it("seed.ts seeds the tenant DEMO_TENANT_ID points at", () => {
    expect(tenantMatch?.[1]).toBe(env.DEMO_TENANT_ID);
  });

  it("found the email format and all three seeded roles", () => {
    // Sanity check on the extraction itself, so a change to seed.ts's shape (not
    // just its content) shows up as a loud failure here instead of silently
    // emptying the expected set below and rubber-stamping every role.
    expect(domainMatch?.[1]).toBeTruthy();
    const roles = new Set(pocUsers.filter((u) => u.active).map((u) => u.role));
    expect([...roles].sort()).toEqual(["admin", "mgmt", "sales"]);
  });

  const domain = domainMatch?.[1] ?? "";
  // Keyed by email → the full active POC user (not just its password), so a
  // test can check which ROLE that email actually belongs to. A map keyed by
  // email → password alone can't catch DEMO_EMAIL_BY_ROLE.sales pointing at
  // the manager's email: that email is still a real active user with a
  // matching password, so a presence-only + password-only check passes while
  // logging the "sales" portal in as management.
  const byEmail = new Map(pocUsers.filter((u) => u.active).map((u) => [`${u.u}@${domain}`, u]));

  it.each(Object.entries(DEMO_EMAIL_BY_ROLE))(
    "DEMO_EMAIL_BY_ROLE.%s (%s) is a real, active seeded user OF THAT ROLE",
    (role, email) => {
      const user = byEmail.get(email as string);
      expect(user).toBeTruthy();
      // The pairing check: not just "some seeded user owns this email", but
      // "the seeded user this email belongs to actually has role `role`".
      expect(user?.role).toBe(role);
    },
  );

  it.each(Object.entries(DEMO_PASSWORD_BY_ROLE))(
    "DEMO_PASSWORD_BY_ROLE.%s is that user's seeded password",
    (role, password) => {
      const email = DEMO_EMAIL_BY_ROLE[role as keyof typeof DEMO_EMAIL_BY_ROLE];
      expect(byEmail.get(email as string)?.p).toBe(password);
    },
  );
});
