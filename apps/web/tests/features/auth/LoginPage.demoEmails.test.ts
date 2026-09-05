import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DEMO_EMAIL_BY_ROLE, DEMO_PASSWORD_BY_ROLE } from "@/features/auth/LoginPage";
import { env } from "@/lib/config";

/**
 * A prefilled demo credential that doesn't belong to any seeded user isn't just
 * wrong — it silently breaks the "click Sign In" happy path for that role. Unit
 * tests that mock the API can't catch this (they'll happily "log in" with a
 * fictitious email), so this test reads the seed's own inputs instead: the
 * dataset json a seed inserts verbatim, plus two anchors in the seed script
 * itself — the tenant id and the email format it derives from each username.
 *
 * Which seed it checks against follows VITE_DEMO_TENANT_ID rather than being
 * hard-coded: the prefill may point at either dataset seed, and the one that
 * declares that tenant is the one whose users must match. Point the prefill at
 * a tenant no seed declares (the deterministic API-test fixture from `db:seed`,
 * say) and the first assertion below fails and tells you so.
 */
/**
 * The dataset jsons hold real customer records and are deliberately NOT
 * committed (checklists/07-SECURITY.md G.3.9), so a clean clone — CI included —
 * does not have them. This suite reads the seed's own inputs, which is exactly
 * what makes it valuable and also what makes it unrunnable without them.
 *
 * So it SKIPS rather than fails when the dataset is absent. That is a real
 * trade-off, not a tidy-up: on CI these assertions do not run, so a demo
 * prefill pointing at a non-existent user would only be caught on a machine
 * that has the dataset. The prefill is forced empty in production builds
 * (src/lib/config.ts, asserted by CI's bundle grep), which is what keeps the
 * gap survivable.
 */
const dbDir = path.resolve(fileURLToPath(import.meta.url), "../../../../../../packages/db/prisma");

/** The dataset seeds a demo prefill may point at: seed script + the json it inserts. */
const SEEDS = [
  { source: "seed-poc.ts", data: "poc-v6-data.json" },
  { source: "seed-promech.ts", data: "promech-data.json" },
];

const tenantSeededBy = (source: string): string | undefined =>
  readFileSync(path.join(dbDir, source), "utf8").match(/const TENANT_ID = "([^"]+)"/)?.[1];

const seed = SEEDS.find((s) => tenantSeededBy(s.source) === env.DEMO_TENANT_ID);
const dataPath = seed ? path.join(dbDir, seed.data) : "";
/** Skip only for the missing (uncommitted) dataset — a tenant no seed declares must FAIL. */
const datasetMissing = Boolean(seed) && !existsSync(dataPath);

describe.skipIf(datasetMissing)("demo login prefill matches an actually-seeded user", () => {
  const seedSource = seed ? readFileSync(path.join(dbDir, seed.source), "utf8") : "";
  // Guarded as well as skipped: vitest still RUNS a describe callback while
  // collecting, even a skipped one, so an unguarded read here would throw
  // during collection and fail the file outright rather than skip it.
  const seededUsers =
    seed && existsSync(dataPath)
      ? (
          JSON.parse(readFileSync(dataPath, "utf8")) as {
            users: { u: string; p: string; role: string; active: boolean }[];
          }
        ).users
      : [];

  // A seed builds each login as `<username>@<domain>` — pull the domain out of
  // the source so renaming it fails here instead of at the login form.
  const domainMatch = seedSource.match(/email:\s*u\.u \+ "@([a-z0-9.-]+)"/);
  it("a dataset seed declares the tenant DEMO_TENANT_ID points at", () => {
    expect(seed?.source, `no seed declares tenant "${env.DEMO_TENANT_ID}"`).toBeTruthy();
  });

  it("found the email format and all three seeded roles", () => {
    // Sanity check on the extraction itself, so a change to the seed's shape (not
    // just its content) shows up as a loud failure here instead of silently
    // emptying the expected set below and rubber-stamping every role.
    expect(domainMatch?.[1]).toBeTruthy();
    const roles = new Set(seededUsers.filter((u) => u.active).map((u) => u.role));
    expect([...roles].sort()).toEqual(["admin", "mgmt", "sales"]);
  });

  const domain = domainMatch?.[1] ?? "";
  // Keyed by email → the full active seeded user (not just its password), so a
  // test can check which ROLE that email actually belongs to. A map keyed by
  // email → password alone can't catch DEMO_EMAIL_BY_ROLE.sales pointing at
  // the manager's email: that email is still a real active user with a
  // matching password, so a presence-only + password-only check passes while
  // logging the "sales" portal in as management.
  const byEmail = new Map(seededUsers.filter((u) => u.active).map((u) => [`${u.u}@${domain}`, u]));

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
