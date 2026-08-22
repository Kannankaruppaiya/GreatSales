import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DEMO_EMAIL_BY_ROLE } from "@/features/auth/LoginPage";
import { env } from "@/lib/config";

/**
 * A prefilled demo email that doesn't belong to any seeded user isn't just wrong —
 * it silently breaks the "click Sign In" happy path for that role. Unit tests that
 * mock the API can't catch this (they'll happily "log in" with a fictitious email),
 * so this test instead reads `packages/db/prisma/seed.ts`'s own source and checks
 * `DEMO_EMAIL_BY_ROLE` against the *actual* emails it creates for the demo tenant —
 * not against a hand-typed duplicate of what the emails are supposed to be.
 */
describe("DEMO_EMAIL_BY_ROLE matches an actually-seeded user", () => {
  const seedPath = path.resolve(
    fileURLToPath(import.meta.url),
    "../../../../../../packages/db/prisma/seed.ts",
  );
  const seedSource = readFileSync(seedPath, "utf8");

  // The demo tenant id is "tenant_<k>" (env.DEMO_TENANT_ID, default "tenant_acme").
  // Confirm the seed actually calls seedTenant(k, ...) for that same k, then pull
  // every `email: \`localpart@${k}.test\`` template out of seedTenant's body — those
  // are the only real users that tenant has.
  const k = env.DEMO_TENANT_ID.replace(/^tenant_/, "");

  it("seed.ts actually seeds the tenant DEMO_TENANT_ID points at", () => {
    expect(seedSource).toMatch(new RegExp(`seedTenant\\(\\s*["']${k}["']`));
  });

  const localParts = [
    ...seedSource.matchAll(/email:\s*`([a-zA-Z0-9_]+)@\$\{k\}\.test`/g),
  ].map((m) => m[1]);
  const seededEmails = new Set(localParts.map((lp) => `${lp}@${k}.test`));

  it("found at least the admin, manager, and a sales user template in seed.ts", () => {
    // Sanity check on the extraction itself, so a change to seed.ts's formatting
    // (not just its content) shows up as a loud failure here instead of silently
    // shrinking `seededEmails` to nothing and rubber-stamping every role below.
    expect(localParts.length).toBeGreaterThanOrEqual(3);
  });

  it.each(Object.entries(DEMO_EMAIL_BY_ROLE))(
    "DEMO_EMAIL_BY_ROLE.%s (%s) is a real seeded user",
    (_role, email) => {
      expect(seededEmails.has(email as string)).toBe(true);
    },
  );
});
