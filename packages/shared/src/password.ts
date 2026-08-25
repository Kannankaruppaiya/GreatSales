/**
 * The single password policy for GreatSales, imported by BOTH the API and the
 * web client so the two can never drift. The server is authoritative; the
 * client uses it only to give immediate feedback before a round trip.
 *
 * Modelled on NIST SP 800-63B: length and a blocklist, deliberately NOT
 * composition rules, which push users toward predictable substitutions
 * ("Password1!") without adding real entropy.
 */

export const PASSWORD_MIN = 12;
/** Bytes, not characters — argon2 hashes the byte string, so this bounds CPU cost. */
export const PASSWORD_MAX = 128;

/** Identity fragments shorter than this are too generic to be worth blocking. */
const IDENTITY_MIN_FRAGMENT = 4;

/**
 * Passwords seen most often in credential-stuffing corpora, normalised to
 * lowercase. Deliberately small and inlined: a full 100k-entry list belongs
 * behind a service call, not in a bundle shipped to every browser. Anything
 * here is rejected outright.
 */
export const COMMON_PASSWORDS: readonly string[] = [
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "password12345",
  "password123456",
  "passw0rd",
  "p@ssw0rd",
  "p@ssword123",
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "12345678910",
  "123456789012",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "qwerty123456",
  "1qaz2wsx3edc",
  "letmein",
  "letmein123",
  "letmein123456",
  "welcome",
  "welcome1",
  "welcome123",
  "welcome12345",
  "admin",
  "admin123",
  "administrator",
  "adminadmin",
  "admin@123456",
  "iloveyou",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "football",
  "abc123",
  "abcd1234",
  "abcdefghijkl",
  "aaaaaaaaaaaa",
  "000000000000",
  "111111111111",
  "changeme",
  "changeme123",
  "trustno1",
  "starwars",
  "superman",
  "greatsales",
  "greatsales123",
  "salesforce123",
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
 * local-part and its word pieces, and the username. Fragments below
 * {@link IDENTITY_MIN_FRAGMENT} characters are dropped — blocking "an" would
 * reject most English passphrases for no security benefit.
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
 * Validates a plaintext password.
 *
 * Returns a discriminated result rather than throwing, so the API can map it to
 * a 400 with a stable code and the web can render it inline — from the same
 * call, with no chance of the two disagreeing about what is acceptable.
 */
export function validatePassword(
  plain: string,
  identity: PasswordIdentity = {},
): PasswordResult {
  if (plain.length < PASSWORD_MIN) return { ok: false, reason: "TOO_SHORT" };

  // Byte length, because argon2's cost scales with bytes: a "64-character"
  // password of multi-byte characters would otherwise cost double to hash.
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
 * Coarse 0-4 strength score for the UI meter ONLY. Never a gate —
 * {@link validatePassword} is the gate. Scores length and character-class
 * variety, which is a reasonable proxy for a progress bar and nothing more.
 */
export function passwordStrength(plain: string): 0 | 1 | 2 | 3 | 4 {
  if (!plain) return 0;
  let score = 0;
  if (plain.length >= PASSWORD_MIN) score++;
  if (plain.length >= 16) score++;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) =>
    re.test(plain),
  ).length;
  if (classes >= 2) score++;
  if (classes >= 3) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}
