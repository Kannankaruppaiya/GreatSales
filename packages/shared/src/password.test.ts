import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordStrength,
  validatePassword,
} from "./password";

const NOBODY = {
  name: "Zaphod Beeblebrox",
  email: "zb@acme.test",
  username: "zaphod",
};

describe("validatePassword", () => {
  it("accepts a long, unrelated, uncommon password", () => {
    expect(validatePassword("correct-horse-battery-staple", NOBODY)).toEqual({
      ok: true,
    });
  });

  it("rejects anything shorter than the minimum", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN - 1), NOBODY)).toEqual({
      ok: false,
      reason: "TOO_SHORT",
    });
  });

  it("accepts exactly the minimum length", () => {
    expect(validatePassword("quixotic-vale", NOBODY).ok).toBe(true);
  });

  it("rejects anything longer than the maximum, to bound argon2 CPU cost", () => {
    expect(validatePassword("a".repeat(PASSWORD_MAX + 1), NOBODY)).toEqual({
      ok: false,
      reason: "TOO_LONG",
    });
  });

  it("measures length in UTF-8 bytes, not code points", () => {
    // 'é' is two bytes, so 65 of them exceed a 128-byte budget even though the
    // string is only 65 characters long.
    expect(validatePassword("é".repeat(65), NOBODY)).toEqual({
      ok: false,
      reason: "TOO_LONG",
    });
  });

  it("rejects a common password even when it is long enough", () => {
    expect(validatePassword("password123456", NOBODY)).toEqual({
      ok: false,
      reason: "TOO_COMMON",
    });
  });

  it("is case-insensitive about common passwords", () => {
    expect(validatePassword("PassWord123456", NOBODY)).toEqual({
      ok: false,
      reason: "TOO_COMMON",
    });
  });

  it("rejects a password containing the username", () => {
    expect(validatePassword("xxzaphodxxxxxxxx", NOBODY)).toEqual({
      ok: false,
      reason: "CONTAINS_IDENTITY",
    });
  });

  it("ignores an email local-part below the significance floor", () => {
    // 'zb' is two characters — too generic to block on.
    expect(validatePassword("qqqqzbqqqqqqqqqq", { email: "zb@acme.test" })).toEqual({
      ok: true,
    });
  });

  it("rejects a password containing a significant email local-part", () => {
    expect(
      validatePassword("qqqqbeeblebroxqq", { email: "beeblebrox@acme.test" }),
    ).toEqual({ ok: false, reason: "CONTAINS_IDENTITY" });
  });

  it("rejects a password containing a name word, case-insensitively", () => {
    expect(validatePassword("xxZaphodxxxxxxxx", { name: "Zaphod Beeblebrox" })).toEqual(
      { ok: false, reason: "CONTAINS_IDENTITY" },
    );
  });

  it("ignores identity fragments shorter than four characters", () => {
    expect(validatePassword("anders-and-more-x", { name: "An Do", username: "an" })).toEqual(
      { ok: true },
    );
  });

  it("checks length before the blocklist, so a short common password reads TOO_SHORT", () => {
    expect(validatePassword("qwerty", NOBODY)).toEqual({ ok: false, reason: "TOO_SHORT" });
  });

  it("applies no policy beyond length when no identity is supplied", () => {
    expect(validatePassword("unremarkable-phrase")).toEqual({ ok: true });
  });
});

describe("passwordStrength", () => {
  it("scores an empty password zero", () => {
    expect(passwordStrength("")).toBe(0);
  });

  it("rises as a password gets longer and more varied", () => {
    const weak = passwordStrength("aaaaaaaaaaaa");
    const strong = passwordStrength("Tr0ubador-and-Sextant!");
    expect(strong).toBeGreaterThan(weak);
  });

  it("never exceeds four", () => {
    expect(passwordStrength("Tr0ubador-and-Sextant!-with-more-length")).toBeLessThanOrEqual(4);
  });
});
